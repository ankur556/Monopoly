"""Converts MonopolyEngine state_dict to fixed-length numpy observation."""
import numpy as np
from .board import BOARD, COLOR_GROUPS
from .game_engine import N_ACTIONS

OBS_DIM = 261  # total observation dimensions


def encode_state(state: dict, legal_actions: list) -> np.ndarray:
    """
    Returns float32 array of shape (OBS_DIM,).

    Layout:
      [0:40]    — property owner: (owner_idx + 1) / n_players, 0 = unowned
      [40:80]   — house count / 5.0
      [80:120]  — mortgaged (0.0 / 1.0)
      [120:126] — player balances / 5000, clipped to [0, 1]
      [126:132] — player positions / 40.0
      [132:138] — in_jail (0.0 / 1.0)
      [138:144] — jail_turns / 3.0
      [144:150] — is_bankrupt (0.0 / 1.0)
      [150:156] — goojf_cards / 2.0, clipped to [0, 1]
      [156]     — current player index / 6.0
      [157]     — last roll die1 / 6.0
      [158]     — last roll die2 / 6.0
      [159]     — pending_property position / 40.0 (0.0 if none)
      [160]     — pending_property flag (1.0 if any)
      [161]     — trade pending flag (1.0 if any)
      [162]     — offerer_idx / 6.0
      [163]     — offeree_idx / 6.0
      [164]     — property_pos / 40.0
      [165]     — amount / 5000.0
      [166:261] — legal action mask (N_ACTIONS = 95 values, 0.0 / 1.0)

    Total: 40 + 40 + 40 + 6 + 6 + 6 + 6 + 6 + 6 + 1 + 1 + 1 + 1 + 1 + 5 + 95 = 261
    """
    obs = np.zeros(OBS_DIM, dtype=np.float32)
    n_players = len(state['players'])
    ownership = state['ownership']

    # [0:40] — owner encoding
    for pos in range(40):
        own = ownership.get(str(pos), {})
        owner = own.get('owner', None)
        if owner is not None:
            obs[pos] = (owner + 1) / max(n_players, 1)
        # else 0.0 (unowned)

    # [40:80] — house count
    for pos in range(40):
        own = ownership.get(str(pos), {})
        houses = own.get('houses', 0)
        obs[40 + pos] = houses / 5.0

    # [80:120] — mortgaged flag
    for pos in range(40):
        own = ownership.get(str(pos), {})
        mortgaged = own.get('mortgaged', False)
        obs[80 + pos] = 1.0 if mortgaged else 0.0

    # [120:126] — player balances (up to 6 players, zero-pad if fewer)
    for i, player in enumerate(state['players']):
        if i >= 6:
            break
        obs[120 + i] = min(player['balance'] / 5000.0, 1.0)

    # [126:132] — player positions
    for i, player in enumerate(state['players']):
        if i >= 6:
            break
        obs[126 + i] = player['position'] / 40.0

    # [132:138] — in_jail
    for i, player in enumerate(state['players']):
        if i >= 6:
            break
        obs[132 + i] = 1.0 if player['in_jail'] else 0.0

    # [138:144] — jail_turns
    for i, player in enumerate(state['players']):
        if i >= 6:
            break
        obs[138 + i] = player['jail_turns'] / 3.0

    # [144:150] — is_bankrupt
    for i, player in enumerate(state['players']):
        if i >= 6:
            break
        obs[144 + i] = 1.0 if player['is_bankrupt'] else 0.0

    # [150:156] — goojf_cards
    for i, player in enumerate(state['players']):
        if i >= 6:
            break
        obs[150 + i] = min(player['goojf_cards'] / 2.0, 1.0)

    # [156] — current player index
    obs[156] = state['current_player'] / 6.0

    # [157:159] — last roll
    last_roll = state.get('last_roll', [0, 0])
    obs[157] = last_roll[0] / 6.0
    obs[158] = last_roll[1] / 6.0

    # [159:161] — pending property
    pending = state.get('pending_property', None)
    if pending is not None:
        obs[159] = pending / 40.0
        obs[160] = 1.0
    else:
        obs[159] = 0.0
        obs[160] = 0.0

    # [161:166] — pending trade
    trade = state.get('pending_trade', None)
    if trade is not None:
        obs[161] = 1.0
        obs[162] = trade['offerer'] / 6.0
        obs[163] = trade['offeree'] / 6.0
        obs[164] = trade['property'] / 40.0
        obs[165] = min(trade['amount'] / 5000.0, 1.0)
    else:
        obs[161:166] = 0.0

    # [166:261] — legal action mask
    mask = action_mask(legal_actions)
    obs[166:166 + N_ACTIONS] = mask.astype(np.float32)

    return obs


def action_mask(legal_actions: list) -> np.ndarray:
    """Returns bool mask of shape (N_ACTIONS,)."""
    mask = np.zeros(N_ACTIONS, dtype=bool)
    for a in legal_actions:
        if 0 <= a < N_ACTIONS:
            mask[a] = True
    return mask
