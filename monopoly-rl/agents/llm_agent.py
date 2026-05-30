"""Groq-backed LLM agent for Monopoly.

Uses llama-3.1-70b-versatile to reason about the current game state and
choose a legal action.  Includes an optional in-process cache so identical
game states never hit the API twice within one collection run.
"""
from __future__ import annotations

import json
import hashlib
import os
import random
from typing import Optional

from groq import Groq
from dotenv import load_dotenv

from env.board import BOARD, COLOR_GROUPS
from env.game_engine import N_ACTIONS

load_dotenv()

# ── Action name table (for LLM context) ──────────────────────────────────────
_ACTION_NAMES: dict[int, str] = {
    0:  "Roll dice",
    1:  "End turn",
    2:  "Buy property",
    3:  "Decline / start auction",
    4:  "Pay $50 jail fine",
    5:  "Use Get-Out-Of-Jail-Free card",
    6:  "Roll for doubles (jail)",
    7:  "Auction: pass",
    8:  "Auction: bid minimum",
    9:  "Auction: bid 15% of balance",
    10: "Auction: bid 30% of balance",
    11: "Auction: bid 60% of balance",
    12: "Auction: bid all",
}
for _pos in range(40):
    _ACTION_NAMES[13 + _pos] = f"Build house on {BOARD[_pos].name} (pos {_pos})"


def _action_name(action_id: int) -> str:
    return _ACTION_NAMES.get(action_id, f"Action {action_id}")


# ── State summariser ──────────────────────────────────────────────────────────

def _summarise_state(state: dict, player_idx: int, legal_actions: list[int]) -> str:
    """Convert state dict to a concise natural-language prompt."""
    p = state["players"][player_idx]
    lines = [
        f"You are Player {player_idx + 1}.",
        (
            f"Balance: ${p['balance']}  |  Position: {BOARD[p['position']].name}  |  "
            f"In jail: {p['in_jail']}  |  GOOJF cards: {p['goojf_cards']}"
        ),
        f"Turn: {state['turn_number']}  |  Phase: {state['phase']}",
    ]

    # Show all players briefly
    lines.append("\nAll players:")
    for pl in state["players"]:
        if pl["is_bankrupt"]:
            lines.append(f"  P{pl['idx']+1}: BANKRUPT")
        else:
            jail_tag = " (JAIL)" if pl["in_jail"] else ""
            lines.append(
                f"  P{pl['idx']+1}: ${pl['balance']} @ {BOARD[pl['position']].name}{jail_tag}"
            )

    # Pending property
    if state.get("pending_property") is not None:
        sq = BOARD[state["pending_property"]]
        lines.append(f"\nPending purchase: {sq.name} costs ${sq.price}")

    # Auction state
    if state.get("auction") is not None:
        auc = state["auction"]
        sq = BOARD[auc["property"]]
        lines.append(
            f"\nAuction: {sq.name} — current bid ${auc['current_bid']} "
            f"by P{(auc['highest_bidder'] or -1)+1}"
        )

    # Owned properties
    my_props = []
    their_props = []
    for pos_str, own in state["ownership"].items():
        pos = int(pos_str)
        sq = BOARD[pos]
        if sq.type not in ("property", "railroad", "utility"):
            continue
        if own["owner"] == player_idx:
            h = own["houses"]
            my_props.append(f"{sq.name}({h}h)")
        elif own["owner"] is not None:
            their_props.append(f"{sq.name}->P{own['owner']+1}")

    if my_props:
        lines.append(f"\nYour properties: {', '.join(my_props)}")
    if their_props:
        lines.append(f"Opponent properties: {', '.join(their_props)}")

    # Legal actions
    lines.append("\nLegal actions:")
    for a in legal_actions:
        lines.append(f"  {a}: {_action_name(a)}")

    return "\n".join(lines)


# ── Agent ────────────────────────────────────────────────────────────────────

class LLMAgent:
    """Monopoly agent powered by a Groq LLM."""

    def __init__(
        self,
        player_idx: int,
        model: str = "llama-3.1-70b-versatile",
        temperature: float = 0.3,
        max_tokens: int = 256,
        max_retries: int = 3,
        cache_enabled: bool = True,
    ):
        self.player_idx = player_idx
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.max_retries = max_retries
        self.cache_enabled = cache_enabled

        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise EnvironmentError(
                "GROQ_API_KEY not set. Copy .env.example to .env and add your key."
            )
        self._client = Groq(api_key=api_key)
        self._cache: dict[str, int] = {}

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _cache_key(self, state: dict, legal_actions: list[int]) -> str:
        payload = json.dumps({"s": state, "a": sorted(legal_actions)}, sort_keys=True)
        return hashlib.md5(payload.encode()).hexdigest()

    # ── Public API ───────────────────────────────────────────────────────────

    def act(self, state: dict, legal_actions: list[int]) -> int:
        """Choose an action via LLM reasoning."""
        if not legal_actions:
            raise ValueError("No legal actions available")

        if len(legal_actions) == 1:
            return legal_actions[0]  # No reasoning needed

        # Cache lookup
        cache_key = None
        if self.cache_enabled:
            cache_key = self._cache_key(state, legal_actions)
            if cache_key in self._cache:
                return self._cache[cache_key]

        summary = _summarise_state(state, self.player_idx, legal_actions)
        system_prompt = (
            "You are an expert Monopoly strategist. Given the game state, choose the best action.\n"
            "Reply with ONLY the integer action ID from the legal actions list — nothing else.\n"
            "Think about: cash flow, monopoly completion, opponent threats, and long-term ROI."
        )

        for attempt in range(self.max_retries):
            try:
                response = self._client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": summary},
                    ],
                    temperature=self.temperature,
                    max_tokens=self.max_tokens,
                )
                raw = response.choices[0].message.content.strip()
                # Extract first integer that is a legal action
                for token in raw.split():
                    token = token.strip(".,;:")
                    if token.lstrip("-").isdigit():
                        action = int(token)
                        if action in legal_actions:
                            if self.cache_enabled and cache_key:
                                self._cache[cache_key] = action
                            return action
            except Exception:
                if attempt == self.max_retries - 1:
                    break

        # Fallback to random legal action
        return random.choice(legal_actions)

    def reset(self):
        """Clear per-game state (cache persists across games)."""
        pass
