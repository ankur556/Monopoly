"""Uniformly random agent -- useful baseline for testing."""
import random


class RandomAgent:
    def __init__(self, player_idx: int):
        self.player_idx = player_idx

    def act(self, state: dict, legal_actions: list[int]) -> int:
        """Choose uniformly random legal action."""
        return random.choice(legal_actions)

    def reset(self): pass
