"""Gymnasium environment wrapping MonopolyEngine."""
import gymnasium as gym
import numpy as np
from .game_engine import MonopolyEngine, N_ACTIONS
from .state_encoder import encode_state, OBS_DIM, action_mask


class MonopolyEnv(gym.Env):
    """
    A Gymnasium-compatible Monopoly environment.

    Observation space: Box(OBS_DIM,) float32 in [0, 1]
    Action space:      Discrete(N_ACTIONS)

    The 'info' dict on every step includes:
        - legal_actions: list of valid action IDs
        - action_mask:   bool ndarray of shape (N_ACTIONS,)
        - current_player: int index of the player whose turn it is
        - state:          raw state dict from MonopolyEngine
    """

    metadata = {'render_modes': []}

    def __init__(self, n_players: int = 4, seed=None):
        super().__init__()
        self.n_players = n_players
        self._seed = seed
        self.engine = MonopolyEngine(n_players=n_players, seed=seed)

        self.observation_space = gym.spaces.Box(
            low=0.0, high=1.0, shape=(OBS_DIM,), dtype=np.float32
        )
        self.action_space = gym.spaces.Discrete(N_ACTIONS)

    # ── Gymnasium API ──────────────────────────────────────────────────────────

    def reset(self, seed=None, options=None):
        """Reset the environment. Returns (obs, info)."""
        super().reset(seed=seed)
        if seed is not None:
            self.engine = MonopolyEngine(n_players=self.n_players, seed=seed)
        else:
            self.engine = MonopolyEngine(n_players=self.n_players, seed=self._seed)

        state = self.engine.reset()
        legal = self.engine.get_legal_actions()
        obs = encode_state(state, legal)
        info = {
            'legal_actions': legal,
            'action_mask': action_mask(legal),
            'current_player': state['current_player'],
            'state': state,
        }
        return obs, info

    def step(self, action: int):
        """
        Execute action.
        Returns (obs, reward, terminated, truncated, info).
        """
        state, reward, done, engine_info = self.engine.step(action)
        legal = self.engine.get_legal_actions() if not done else []
        obs = encode_state(state, legal)
        info = {
            'legal_actions': legal,
            'action_mask': action_mask(legal),
            'current_player': state['current_player'],
            'state': state,
            **engine_info,
        }
        return obs, float(reward), done, False, info

    def get_legal_actions(self):
        """Convenience method: returns legal actions for current player."""
        return self.engine.get_legal_actions()

    def render(self):
        """No rendering implemented."""
        pass

    def close(self):
        pass
