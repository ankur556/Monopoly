"""Data collector — runs LLM vs LLM games and saves (obs, action) pairs."""
from __future__ import annotations

import os
import time
import threading
import numpy as np
from pathlib import Path
from typing import Optional
from tqdm import tqdm

from env.monopoly_env import MonopolyEnv
from agents.llm_agent import LLMAgent
from agents.random_agent import RandomAgent


class DataCollector:
    """
    Runs n_games of LLM self-play and records every (observation, action) pair.

    Data is saved as compressed NumPy archives:
        {save_dir}/games_{start}_{end}.npz
            observations: float32 [N, obs_dim]
            actions:      int32   [N]
            game_ids:     int32   [N]
    """

    def __init__(
        self,
        n_games: int = 1000,
        save_dir: str = "data_collected",
        n_workers: int = 4,
        checkpoint_every: int = 50,
        llm_model: str = "llama-3.1-70b-versatile",
        llm_temperature: float = 0.3,
        max_tokens: int = 256,
        cache_enabled: bool = True,
        n_players: int = 4,
        max_turns: int = 500,
        seed: Optional[int] = None,
    ):
        self.n_games = n_games
        self.save_dir = Path(save_dir)
        self.save_dir.mkdir(parents=True, exist_ok=True)
        self.n_workers = n_workers
        self.checkpoint_every = checkpoint_every
        self.llm_model = llm_model
        self.llm_temperature = llm_temperature
        self.max_tokens = max_tokens
        self.cache_enabled = cache_enabled
        self.n_players = n_players
        self.max_turns = max_turns
        self.seed = seed

        self._lock = threading.Lock()
        self._completed = 0

    # ── Single-game runner ───────────────────────────────────────────────────

    def _run_game(self, game_id: int) -> tuple[np.ndarray, np.ndarray]:
        """Play one full game. Returns (observations, actions) arrays."""
        env = MonopolyEnv(n_players=self.n_players)

        # Build agents — player 0 is the LLM; others random to keep API calls low
        # and avoid rate-limiting issues. For richer data, increase LLM players.
        agents = []
        for i in range(self.n_players):
            try:
                agent = LLMAgent(
                    player_idx=i,
                    model=self.llm_model,
                    temperature=self.llm_temperature,
                    max_tokens=self.max_tokens,
                    cache_enabled=self.cache_enabled,
                )
            except EnvironmentError:
                # Fall back to random if no API key (useful for testing)
                agent = RandomAgent(player_idx=i)
            agents.append(agent)

        obs, info = env.reset(seed=self.seed)
        observations: list[np.ndarray] = []
        actions_taken: list[int] = []

        done = False
        step_count = 0
        while not done and step_count < self.max_turns:
            current_player = env.engine.current_player
            legal_actions = info.get("legal_actions", env.engine.get_legal_actions())

            if not legal_actions:
                break

            state = env.engine.state_dict()
            action = agents[current_player].act(state, legal_actions)

            observations.append(obs.copy())
            actions_taken.append(action)

            obs, reward, terminated, truncated, info = env.step(action)
            done = terminated or truncated
            step_count += 1

        if not observations:
            return np.empty((0, env.observation_space.shape[0]), dtype=np.float32), np.empty(0, dtype=np.int32)

        return (
            np.stack(observations).astype(np.float32),
            np.array(actions_taken, dtype=np.int32),
        )

    # ── Checkpoint helper ────────────────────────────────────────────────────

    def _save_checkpoint(
        self,
        obs_buf: list[np.ndarray],
        act_buf: list[np.ndarray],
        gid_buf: list[np.ndarray],
        start_idx: int,
        end_idx: int,
    ):
        if not obs_buf:
            return
        path = self.save_dir / f"games_{start_idx:05d}_{end_idx:05d}.npz"
        np.savez_compressed(
            path,
            observations=np.concatenate(obs_buf),
            actions=np.concatenate(act_buf),
            game_ids=np.concatenate(gid_buf),
        )

    # ── Public API ───────────────────────────────────────────────────────────

    def collect(self) -> None:
        """Run data collection (single-threaded with tqdm progress)."""
        obs_buf: list[np.ndarray] = []
        act_buf: list[np.ndarray] = []
        gid_buf: list[np.ndarray] = []
        checkpoint_start = 0

        with tqdm(total=self.n_games, desc="Collecting games", unit="game") as pbar:
            for game_id in range(self.n_games):
                t0 = time.time()
                obs_arr, act_arr = self._run_game(game_id)
                elapsed = time.time() - t0

                obs_buf.append(obs_arr)
                act_buf.append(act_arr)
                gid_buf.append(np.full(len(act_arr), game_id, dtype=np.int32))

                pbar.set_postfix(
                    steps=len(act_arr),
                    secs=f"{elapsed:.1f}",
                    total_steps=sum(len(a) for a in act_buf),
                )
                pbar.update(1)

                # Checkpoint
                if (game_id + 1) % self.checkpoint_every == 0:
                    self._save_checkpoint(obs_buf, act_buf, gid_buf, checkpoint_start, game_id)
                    obs_buf.clear()
                    act_buf.clear()
                    gid_buf.clear()
                    checkpoint_start = game_id + 1

        # Save remaining
        if obs_buf:
            self._save_checkpoint(obs_buf, act_buf, gid_buf, checkpoint_start, self.n_games - 1)

        total = sum(
            np.load(f)["actions"].shape[0]
            for f in self.save_dir.glob("*.npz")
        )
        print(f"\nCollection complete. {total:,} steps saved to {self.save_dir}/")

    def load_all(self) -> tuple[np.ndarray, np.ndarray]:
        """Load all saved data into memory. Returns (observations, actions)."""
        files = sorted(self.save_dir.glob("*.npz"))
        if not files:
            raise FileNotFoundError(f"No .npz files found in {self.save_dir}")

        obs_list, act_list = [], []
        for f in files:
            data = np.load(f)
            obs_list.append(data["observations"])
            act_list.append(data["actions"])

        return np.concatenate(obs_list), np.concatenate(act_list)
