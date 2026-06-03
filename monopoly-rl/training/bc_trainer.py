"""Behavioral Cloning trainer — Stage 1 of the Monopoly RL pipeline."""
from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, random_split
from tqdm import tqdm

from .policy_network import PolicyNetwork

try:
    import wandb
    _HAS_WANDB = True
except ImportError:
    _HAS_WANDB = False


# ── Dataset ──────────────────────────────────────────────────────────────────

class MonopolyDataset(Dataset):
    """Simple (obs, action) dataset for behavioral cloning."""

    def __init__(self, observations: np.ndarray, actions: np.ndarray):
        assert len(observations) == len(actions), "Length mismatch"
        self.obs = torch.from_numpy(observations.astype(np.float32))
        self.actions = torch.from_numpy(actions.astype(np.int64))

    def __len__(self) -> int:
        return len(self.actions)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        return self.obs[idx], self.actions[idx]


# ── Trainer ──────────────────────────────────────────────────────────────────

class BCTrainer:
    """
    Trains a PolicyNetwork via cross-entropy loss on LLM-collected data.

    Usage:
        trainer = BCTrainer(obs, actions, save_dir="models/bc")
        trainer.train()
    """

    def __init__(
        self,
        observations: np.ndarray,
        actions: np.ndarray,
        save_dir: str = "models/bc",
        epochs: int = 50,
        batch_size: int = 256,
        lr: float = 3e-4,
        val_split: float = 0.1,
        device: str = "auto",
        early_stop_patience: int = 5,
        use_wandb: bool = False,
        wandb_project: str = "monopoly-rl",
        hidden: int = 512,
    ):
        self.save_dir = Path(save_dir)
        self.save_dir.mkdir(parents=True, exist_ok=True)
        self.epochs = epochs
        self.batch_size = batch_size
        self.lr = lr
        self.val_split = val_split
        self.early_stop_patience = early_stop_patience
        self.use_wandb = use_wandb and _HAS_WANDB

        # Device
        if device == "auto":
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device
        print(f"[BCTrainer] Using device: {self.device}")

        # Dataset split
        dataset = MonopolyDataset(observations, actions)
        n_val = max(1, int(len(dataset) * val_split))
        n_train = len(dataset) - n_val
        train_ds, val_ds = random_split(dataset, [n_train, n_val])
        self.train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=0)
        self.val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=0)
        print(f"[BCTrainer] Train: {n_train:,} steps | Val: {n_val:,} steps")

        # Model
        obs_dim = observations.shape[1]
        n_actions = int(actions.max()) + 1
        self.model = PolicyNetwork(obs_dim=obs_dim, n_actions=n_actions, hidden=hidden).to(self.device)
        self.optimizer = torch.optim.Adam(self.model.parameters(), lr=lr)
        self.scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
            self.optimizer, T_max=epochs, eta_min=lr * 0.01
        )
        self.criterion = nn.CrossEntropyLoss()

        if self.use_wandb:
            wandb.init(project=wandb_project, config={
                "epochs": epochs, "batch_size": batch_size, "lr": lr,
                "obs_dim": obs_dim, "n_actions": n_actions, "hidden": hidden,
            })

    # ── Internal helpers ─────────────────────────────────────────────────────

    def _run_epoch(self, loader: DataLoader, train: bool) -> tuple[float, float]:
        """Run one epoch. Returns (loss, accuracy)."""
        self.model.train(train)
        total_loss = 0.0
        correct = 0
        total = 0

        with torch.set_grad_enabled(train):
            for obs, actions in loader:
                obs = obs.to(self.device)
                actions = actions.to(self.device)

                logits = self.model.get_action_logits(obs)
                loss = self.criterion(logits, actions)

                if train:
                    self.optimizer.zero_grad()
                    loss.backward()
                    nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
                    self.optimizer.step()

                total_loss += loss.item() * len(actions)
                preds = logits.argmax(dim=-1)
                correct += (preds == actions).sum().item()
                total += len(actions)

        return total_loss / total, correct / total

    # ── Public API ───────────────────────────────────────────────────────────

    def train(self) -> PolicyNetwork:
        """Run full BC training. Returns the best model."""
        best_val_loss = float("inf")
        patience_counter = 0
        best_path = self.save_dir / "best_model.pt"

        print(f"\n{'='*50}")
        print(f"Behavioral Cloning Training — {self.epochs} epochs")
        print(f"{'='*50}\n")

        for epoch in range(1, self.epochs + 1):
            t0 = time.time()
            train_loss, train_acc = self._run_epoch(self.train_loader, train=True)
            val_loss, val_acc = self._run_epoch(self.val_loader, train=False)
            self.scheduler.step()
            elapsed = time.time() - t0

            print(
                f"Epoch {epoch:3d}/{self.epochs} | "
                f"Train loss: {train_loss:.4f} acc: {train_acc:.3f} | "
                f"Val loss: {val_loss:.4f} acc: {val_acc:.3f} | "
                f"{elapsed:.1f}s"
            )

            if self.use_wandb:
                wandb.log({
                    "epoch": epoch,
                    "train/loss": train_loss, "train/acc": train_acc,
                    "val/loss": val_loss, "val/acc": val_acc,
                    "lr": self.scheduler.get_last_lr()[0],
                })

            # Save checkpoint every epoch
            ckpt_path = self.save_dir / f"epoch_{epoch:03d}.pt"
            self.model.save(str(ckpt_path))

            # Early stopping & best model
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                patience_counter = 0
                self.model.save(str(best_path))
                print(f"  > New best model saved (val_loss={val_loss:.4f})")
            else:
                patience_counter += 1
                if patience_counter >= self.early_stop_patience:
                    print(f"\nEarly stopping at epoch {epoch} (patience={self.early_stop_patience})")
                    break

        print(f"\nTraining complete. Best model: {best_path}")
        if self.use_wandb:
            wandb.finish()

        return PolicyNetwork.load(str(best_path), device=self.device)
