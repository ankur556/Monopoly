"""CLI entry point for Stage 2 PPO self-play training."""
from __future__ import annotations

import os
import click
import yaml
from pathlib import Path


@click.command()
@click.option("--total-timesteps", default=None, type=int, help="Total PPO timesteps")
@click.option("--n-envs", default=None, type=int, help="Parallel environments")
@click.option("--save-dir", default=None, type=str, help="Model save directory")
@click.option("--bc-model", default=None, type=str, help="BC model path to initialise from")
@click.option("--device", default="cpu", type=str, help="cuda / cpu")
@click.option("--wandb/--no-wandb", "use_wandb", default=False, help="Enable W&B logging")
@click.option("--config", default="config.yaml", type=str, help="Path to config file")
def main(total_timesteps, n_envs, save_dir, bc_model, device, use_wandb, config):
    """Train PPO agent via self-play, optionally initialised from BC weights."""
    from dotenv import load_dotenv
    load_dotenv()

    # Load config
    cfg = {}
    if Path(config).exists():
        with open(config) as f:
            cfg = yaml.safe_load(f) or {}
    ppo_cfg = cfg.get("ppo", {})
    bc_cfg = cfg.get("behavioral_cloning", {})
    server_cfg = cfg.get("server", {})

    total_timesteps = total_timesteps or ppo_cfg.get("total_timesteps", 5_000_000)
    n_envs = n_envs or ppo_cfg.get("n_envs", 8)
    save_dir = save_dir or ppo_cfg.get("save_dir", "models/ppo")
    bc_model = bc_model or server_cfg.get("bc_model_path", "models/bc/best_model.pt")

    Path(save_dir).mkdir(parents=True, exist_ok=True)

    click.echo(f"Stage 2: PPO self-play training")
    click.echo(f"  total_timesteps: {total_timesteps:,}")
    click.echo(f"  n_envs:          {n_envs}")
    click.echo(f"  save_dir:        {save_dir}/")

    # ── Import heavy deps here to keep CLI fast ───────────────────────────────
    import torch
    import numpy as np
    from stable_baselines3 import PPO
    from stable_baselines3.common.vec_env import SubprocVecEnv, VecMonitor
    from stable_baselines3.common.callbacks import (
        CheckpointCallback, EvalCallback,
    )
    from stable_baselines3.common.env_util import make_vec_env

    from env.monopoly_env import MonopolyEnv
    from training.policy_network import PolicyNetwork
    from env.game_engine import N_ACTIONS

    # ── Build vectorised environments ─────────────────────────────────────────
    def _make_env(rank: int):
        def _init():
            return MonopolyEnv(n_players=4, seed=rank)
        return _init

    click.echo(f"Building {n_envs} parallel environments...")
    # Use DummyVecEnv on Windows (SubprocVecEnv has spawn issues)
    from stable_baselines3.common.vec_env import DummyVecEnv
    vec_env = DummyVecEnv([_make_env(i) for i in range(n_envs)])
    vec_env = VecMonitor(vec_env)

    eval_env = DummyVecEnv([_make_env(9999)])
    eval_env = VecMonitor(eval_env)

    # ── PPO hyperparameters ───────────────────────────────────────────────────
    ppo_kwargs = dict(
        policy="MlpPolicy",
        env=vec_env,
        n_steps=ppo_cfg.get("n_steps", 2048),
        batch_size=ppo_cfg.get("batch_size", 64),
        n_epochs=ppo_cfg.get("n_epochs", 10),
        learning_rate=ppo_cfg.get("learning_rate", 3e-4),
        gamma=ppo_cfg.get("gamma", 0.99),
        gae_lambda=ppo_cfg.get("gae_lambda", 0.95),
        clip_range=ppo_cfg.get("clip_range", 0.2),
        ent_coef=ppo_cfg.get("ent_coef", 0.01),
        device=device,
        verbose=1,
        tensorboard_log=f"{save_dir}/tb_logs",
    )

    model = PPO(**ppo_kwargs)

    # ── Initialise policy from BC weights ─────────────────────────────────────
    bc_path = Path(bc_model)
    if bc_path.exists():
        click.echo(f"Loading BC weights from {bc_path}...")
        try:
            bc_net = PolicyNetwork.load(str(bc_path), device=device)
            # Copy trunk + policy head weights into SB3's MlpPolicy
            sb3_net = model.policy.mlp_extractor
            # Note: SB3 MlpPolicy has its own architecture; we do a partial
            # weight transfer via policy network's trunk parameters
            bc_state = bc_net.state_dict()
            policy_state = model.policy.state_dict()
            transferred = 0
            for k, v in bc_state.items():
                if k in policy_state and policy_state[k].shape == v.shape:
                    policy_state[k] = v
                    transferred += 1
            model.policy.load_state_dict(policy_state, strict=False)
            click.echo(f"  Transferred {transferred} weight tensors from BC model.")
        except Exception as e:
            click.echo(f"  Warning: could not load BC weights: {e}")
    else:
        click.echo(f"No BC model found at {bc_path}, training from scratch.")

    # ── Callbacks ─────────────────────────────────────────────────────────────
    checkpoint_cb = CheckpointCallback(
        save_freq=max(ppo_cfg.get("checkpoint_every", 100_000) // n_envs, 1),
        save_path=save_dir,
        name_prefix="ppo_checkpoint",
    )
    eval_cb = EvalCallback(
        eval_env,
        best_model_save_path=save_dir,
        log_path=f"{save_dir}/eval_logs",
        eval_freq=max(ppo_cfg.get("eval_every", 50_000) // n_envs, 1),
        n_eval_episodes=ppo_cfg.get("eval_episodes", 20),
        deterministic=True,
        render=False,
    )

    # ── W&B ───────────────────────────────────────────────────────────────────
    if use_wandb:
        try:
            import wandb
            wandb.init(
                project=os.getenv("WANDB_PROJECT", "monopoly-rl"),
                config={"stage": "ppo", **ppo_cfg},
            )
        except Exception:
            pass

    # ── Train ─────────────────────────────────────────────────────────────────
    click.echo(f"\nStarting PPO training for {total_timesteps:,} timesteps...")
    model.learn(
        total_timesteps=total_timesteps,
        callback=[checkpoint_cb, eval_cb],
        progress_bar=True,
    )

    # Save final model
    final_path = f"{save_dir}/final_model"
    model.save(final_path)
    click.echo(f"\nPPO training complete. Final model saved to {final_path}.zip")

    if use_wandb:
        try:
            import wandb
            wandb.finish()
        except Exception:
            pass


if __name__ == "__main__":
    main()
