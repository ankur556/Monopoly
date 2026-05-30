"""Policy network for Monopoly RL — shared between BC and PPO."""
from __future__ import annotations

import torch
import torch.nn as nn
from env.game_engine import N_ACTIONS

OBS_DIM = 214


class PolicyNetwork(nn.Module):
    """
    MLP policy that maps a 214-dim observation to action logits.

    Architecture:
        Linear(214 → 512) → LayerNorm → ReLU
        Linear(512 → 512) → LayerNorm → ReLU
        Linear(512 → 256) → LayerNorm → ReLU
        Linear(256 → 53)   ← action logits

    Also includes a separate value head for PPO:
        Linear(256 → 1)
    """

    def __init__(self, obs_dim: int = OBS_DIM, n_actions: int = N_ACTIONS, hidden: int = 512):
        super().__init__()
        self.obs_dim = obs_dim
        self.n_actions = n_actions

        self.trunk = nn.Sequential(
            nn.Linear(obs_dim, hidden),
            nn.LayerNorm(hidden),
            nn.ReLU(),
            nn.Linear(hidden, hidden),
            nn.LayerNorm(hidden),
            nn.ReLU(),
            nn.Linear(hidden, hidden // 2),
            nn.LayerNorm(hidden // 2),
            nn.ReLU(),
        )
        self.policy_head = nn.Linear(hidden // 2, n_actions)
        self.value_head = nn.Linear(hidden // 2, 1)

        # Orthogonal init (standard for RL)
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.orthogonal_(m.weight, gain=1.0)
                nn.init.zeros_(m.bias)
        # Smaller init for policy head (helps initial entropy)
        nn.init.orthogonal_(self.policy_head.weight, gain=0.01)

    def forward(self, obs: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            obs: [batch, obs_dim]
        Returns:
            logits: [batch, n_actions]
            value:  [batch]
        """
        features = self.trunk(obs)
        logits = self.policy_head(features)
        value = self.value_head(features).squeeze(-1)
        return logits, value

    def get_action_logits(self, obs: torch.Tensor) -> torch.Tensor:
        """Convenience: just the action logits."""
        features = self.trunk(obs)
        return self.policy_head(features)

    def masked_action(
        self,
        obs: torch.Tensor,
        legal_mask: torch.Tensor,
        deterministic: bool = False,
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Sample an action with illegal actions masked out.

        Args:
            obs:          [batch, obs_dim]
            legal_mask:   [batch, n_actions] boolean tensor (True = legal)
            deterministic: if True, take argmax instead of sampling

        Returns:
            actions:  [batch] int64
            log_prob: [batch] float
            entropy:  [batch] float
        """
        features = self.trunk(obs)
        logits = self.policy_head(features)

        # Mask illegal actions with -inf
        logits = logits.masked_fill(~legal_mask, float("-inf"))
        dist = torch.distributions.Categorical(logits=logits)

        if deterministic:
            actions = logits.argmax(dim=-1)
        else:
            actions = dist.sample()

        return actions, dist.log_prob(actions), dist.entropy()

    def save(self, path: str):
        torch.save({"state_dict": self.state_dict(), "obs_dim": self.obs_dim, "n_actions": self.n_actions}, path)

    @classmethod
    def load(cls, path: str, device: str = "cpu") -> "PolicyNetwork":
        ckpt = torch.load(path, map_location=device)
        net = cls(obs_dim=ckpt["obs_dim"], n_actions=ckpt["n_actions"])
        net.load_state_dict(ckpt["state_dict"])
        net.to(device)
        return net
