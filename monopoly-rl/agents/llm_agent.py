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
    _ACTION_NAMES[53 + _pos] = f"Offer to buy {BOARD[_pos].name} for 1.5x market value (pos {_pos})"

_ACTION_NAMES[93] = "Accept trade offer"
_ACTION_NAMES[94] = "Reject trade offer"

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

    # Auction state — give LLM full property economics for smart bidding
    if state.get("auction") is not None:
        auc = state["auction"]
        sq = BOARD[auc["property"]]
        lines.append(f"\n=== AUCTION IN PROGRESS ===")
        lines.append(f"Property: {sq.name} (Position {sq.position})")
        lines.append(f"List Price: ${sq.price}  |  Mortgage Value: ${sq.mortgage_value}")
        if sq.rents and len(sq.rents) >= 6:
            lines.append(f"Rent Table: base=${sq.rents[0]}, 1h=${sq.rents[1]}, 2h=${sq.rents[2]}, 3h=${sq.rents[3]}, 4h=${sq.rents[4]}, hotel=${sq.rents[5]}")
        elif sq.rents:
            lines.append(f"Rent values: {', '.join(f'${r}' for r in sq.rents)}")
        if sq.color:
            group_positions = COLOR_GROUPS.get(sq.color, [])
            group_names = [BOARD[gp].name for gp in group_positions]
            # Check how many in this color group the bidder already owns
            owned_in_group = sum(1 for gp in group_positions if state["ownership"].get(str(gp), {}).get("owner") == player_idx)
            lines.append(f"Color Group: {sq.color} ({', '.join(group_names)})")
            lines.append(f"You own {owned_in_group}/{len(group_positions)} in this group. {'BUYING THIS COMPLETES YOUR MONOPOLY!' if owned_in_group == len(group_positions) - 1 else ''}")
        if sq.type == "railroad":
            rr_positions = [5, 15, 25, 35]
            owned_rr = sum(1 for rp in rr_positions if state["ownership"].get(str(rp), {}).get("owner") == player_idx)
            lines.append(f"Railroad. You own {owned_rr}/4 railroads. Rent scales: $25/$50/$100/$200")
        if sq.type == "utility":
            lines.append(f"Utility. Rent = 4x dice (1 util) or 10x dice (2 utils)")
        lines.append(f"Current Bid: ${auc['current_bid']} by P{(auc['highest_bidder'] or -1)+1}")
        lines.append(f"Your Balance: ${p['balance']}")

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
            "You are an expert, highly competitive Monopoly AI agent. Your ultimate goal is to win the game by acquiring assets, completing color sets, and bankrupting your opponents.\n\n"
            "CRITICAL STRATEGIC DIRECTIVES:\n"
            "1. PROPERTY ACQUISITION IS MANDATORY: You cannot win Monopoly by hoarding cash. If you land on an unowned property and have sufficient funds, you MUST buy it.\n"
            "2. IGNORE RISK AVERSION: Do not skip buying a property just to keep a high cash balance. Early in the game, your priority is to convert cash into real estate. Only pass on an unowned property if buying it would force you into immediate bankruptcy.\n"
            "3. VALUE ASSETS OVER CASH: Properties generate rent and can be mortgaged later if you need emergency cash. An unowned property is an opportunity you cannot afford to miss.\n\n"
            "AUCTION BIDDING STRATEGY:\n"
            "When an auction is in progress, use this logic to decide how much to bid:\n"
            "- If the property completes a MONOPOLY for you: bid up to 2x the list price (you will make it back in rent).\n"
            "- If the property is in a color group where you already own 1+: bid up to 1.5x the list price.\n"
            "- If the property is a railroad and you already own 1+: bid up to the list price.\n"
            "- For any other unowned property: bid up to the list price.\n"
            "- NEVER pass on an auction if your balance exceeds the current bid. Passing means an opponent gets it for free.\n"
            "- Choose the bid tier that gets closest to your target bid without exceeding your balance.\n"
            "  Action 8 = bid $1 above current. Action 9 = bid 15% of balance. Action 10 = bid 30%. Action 11 = bid 60%. Action 12 = bid entire balance.\n\n"
            "STRICT OUTPUT FORMAT:\n"
            "Output your decision as a strict JSON object containing the integer 'action_id' from the Legal Actions list.\n"
            "Example Output:\n"
            '{"action_id": 2}'
        )

        # Force Groq to return JSON
        self._client = Groq(api_key=os.getenv("GROQ_API_KEY"))

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
                    response_format={"type": "json_object"},
                )
                raw = response.choices[0].message.content.strip()
                parsed = json.loads(raw)
                if "action_id" in parsed:
                    action = int(parsed["action_id"])
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
