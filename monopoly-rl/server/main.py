"""FastAPI model server — exposes the trained Monopoly agent over HTTP."""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Optional

# Ensure the parent directory (monopoly-rl) is in the python path
sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# ── Request / Response schemas ────────────────────────────────────────────────

class ActRequest(BaseModel):
    state: list[float]          # 214-dim observation vector
    legal_actions: list[int]    # list of valid action IDs


class ActResponse(BaseModel):
    action: int
    model_type: str             # "ppo" or "bc"

from server.frontend_adapter import FrontendActRequest, FrontendActResponse, parse_frontend_state, map_action_to_frontend


# ── App setup ─────────────────────────────────────────────────────────────────

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Monopoly RL Model Server",
    description="Serves trained Monopoly RL agents via REST API.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model globals — loaded at startup
_model = None
_model_type: str = "none"
_device: str = "cpu"
_n_actions: int = 53
_obs_dim: int = 214


def _load_model(ppo_path: str, bc_path: str, device: str):
    """Try to load PPO first, fall back to BC."""
    global _model, _model_type, _device, _n_actions, _obs_dim
    _device = device

    # Try PPO (Stable-Baselines3 zip)
    ppo_p = Path(ppo_path)
    if ppo_p.exists():
        try:
            from sb3_contrib import MaskablePPO
            _model = MaskablePPO.load(str(ppo_p), device=device)
            _model_type = "ppo"
            print(f"[Server] Loaded PPO model from {ppo_p}")
            return
        except Exception as e:
            print(f"[Server] Could not load PPO model: {e}")

    # Fall back to BC
    bc_p = Path(bc_path)
    if bc_p.exists():
        try:
            import sys
            sys.path.insert(0, str(Path(__file__).parent.parent))
            from training.policy_network import PolicyNetwork
            _model = PolicyNetwork.load(str(bc_p), device=device)
            _model.eval()
            _model_type = "bc"
            print(f"[Server] Loaded BC model from {bc_p}")
            return
        except Exception as e:
            print(f"[Server] Could not load BC model: {e}")

    print("[Server] WARNING: No model loaded. /act will return random actions.")
    _model_type = "random"


@app.on_event("startup")
async def startup_event():
    ppo_path = os.getenv("PPO_MODEL_PATH", "models/ppo/best_model.zip")
    bc_path = os.getenv("BC_MODEL_PATH", "models/bc/best_model.pt")
    device = os.getenv("MODEL_DEVICE", "cpu")
    _load_model(ppo_path, bc_path, device)

    # Instantiate LLM Agent for Hybrid Auction Logic
    from agents.llm_agent import LLMAgent
    global _llm_agent
    try:
        _llm_agent = LLMAgent(player_idx=0, max_retries=2)
    except EnvironmentError:
        _llm_agent = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "status": "ok",
        "model_type": _model_type,
        "obs_dim": _obs_dim,
        "n_actions": _n_actions,
    }


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": _model is not None}


@app.post("/act", response_model=ActResponse)
async def act(request: ActRequest):
    """Choose an action given the current observation and legal actions."""
    if not request.legal_actions:
        raise HTTPException(status_code=400, detail="legal_actions must not be empty")

    if len(request.state) != _obs_dim:
        raise HTTPException(
            status_code=400,
            detail=f"Expected state of length {_obs_dim}, got {len(request.state)}",
        )

    legal = request.legal_actions

    # Random fallback if no model
    if _model is None or _model_type == "random":
        import random
        return ActResponse(action=random.choice(legal), model_type="random")

    obs = np.array(request.state, dtype=np.float32)

    if _model_type == "ppo":
        action, _ = _model.predict(obs, deterministic=True)
        action = int(action)
        # Ensure action is legal
        if action not in legal:
            action = legal[0]

    elif _model_type == "bc":
        with torch.no_grad():
            obs_t = torch.from_numpy(obs).unsqueeze(0).to(_device)
            legal_mask = torch.zeros(1, _n_actions, dtype=torch.bool, device=_device)
            for a in legal:
                if a < _n_actions:
                    legal_mask[0, a] = True
            actions, _, _ = _model.masked_action(obs_t, legal_mask, deterministic=True)
            action = int(actions[0].cpu().item())
    else:
        import random
        action = random.choice(legal)

    return ActResponse(action=action, model_type=_model_type)

@app.post("/act_frontend", response_model=FrontendActResponse)
async def act_frontend(request: FrontendActRequest):
    """Choose an action given the frontend JSON state.
    
    Decision hierarchy:
      1. BUY phase  → deterministic heuristic (buy if affordable)
      2. AUCTION    → LLM with EV-capped bidding
      3. Everything else (ROLL, END_TURN, BUILD) → RL model
    """

    # 1. Parse into state_dict and reconstruct engine
    state_dict, engine = parse_frontend_state(request)
    
    # 2. Get legal actions (filter out trade offers)
    legal = engine.get_legal_actions()
    from env.game_engine import (
        OFFER_TRADE_BASE, ACCEPT_TRADE, BUY_PROP, DECLINE, END_TURN,
        AUCTION_PASS, AUCTION_BID_MIN, AUCTION_BID_LOW, AUCTION_BID_MED,
        AUCTION_BID_HIGH, AUCTION_BID_ALL, BUILD_BASE
    )
    legal = [a for a in legal if not (OFFER_TRADE_BASE <= a < ACCEPT_TRADE)]
    
    # Debug logging
    phase_name = engine.phase.value if hasattr(engine.phase, 'value') else str(engine.phase)
    action_names = {
        0: "ROLL", 1: "END_TURN", 2: "BUY_PROP", 3: "DECLINE",
        4: "PAY_JAIL", 5: "USE_GOOJF", 6: "ROLL_JAIL",
        7: "AUCTION_PASS", 8: "BID_MIN", 9: "BID_LOW",
        10: "BID_MED", 11: "BID_HIGH", 12: "BID_ALL"
    }
    legal_names = [action_names.get(a, f"BUILD_{a-13}" if 13 <= a < 53 else f"action_{a}") for a in legal]
    print(f"[Bot] Phase={phase_name} | Player={engine.current_player} | Legal={legal_names} | pendingAction={request.pendingAction}")
    
    if not legal:
        return map_action_to_frontend(END_TURN)

    # ══════════════════════════════════════════════════════════════════════════
    #  PHASE 1: BUY — Smart heuristic (like a real human player)
    # ══════════════════════════════════════════════════════════════════════════
    if engine.phase == "BUY" and BUY_PROP in legal:
        from env.board import BOARD, COLOR_GROUPS
        player = engine.players[engine.current_player]
        sq = BOARD[engine.pending_property]
        
        # Calculate property valuation for this bot
        valuation = _property_valuation(state_dict, engine.current_player, engine.pending_property)
        
        # A real human buys a property if they can afford it and keep a safety net.
        # Early game (turn < 30): be aggressive, keep only $100 reserve
        # Mid game (turn 30-60): moderate, keep $200 reserve 
        # Late game (turn > 60): conservative, keep $300 reserve
        turn = state_dict.get("turn_number", 0)
        if turn < 30:
            min_reserve = 100
        elif turn < 60:
            min_reserve = 200
        else:
            min_reserve = 300
        
        can_afford = player.balance - sq.price >= min_reserve
        
        # ALWAYS buy if it completes a monopoly (even if it drains cash)
        completes_monopoly = False
        if sq.color:
            group = COLOR_GROUPS.get(sq.color, [])
            owned_count = sum(1 for gp in group if engine.ownership[gp].owner == engine.current_player)
            if owned_count == len(group) - 1:
                completes_monopoly = True
        
        # ALWAYS buy if we can afford it, OR if it completes a monopoly
        if can_afford or completes_monopoly:
            action = BUY_PROP
            print(f"[Bot] HEURISTIC: Buying {sq.name} for ${sq.price} (balance=${player.balance}, reserve=${min_reserve}, monopoly={completes_monopoly}, valuation=${valuation})")
        else:
            action = DECLINE
            print(f"[Bot] HEURISTIC: Declining {sq.name} — can't afford ${sq.price} with ${min_reserve} reserve (balance=${player.balance})")
        
        result = map_action_to_frontend(action)
        print(f"[Bot] -> {result.actionType}")
        return result

    # ══════════════════════════════════════════════════════════════════════════
    #  PHASE 2: AUCTION — EV-capped heuristic bidding (no LLM needed)
    # ══════════════════════════════════════════════════════════════════════════
    if engine.phase == "AUCTION" and any(a in legal for a in [AUCTION_PASS, AUCTION_BID_MIN, AUCTION_BID_LOW, AUCTION_BID_MED, AUCTION_BID_HIGH, AUCTION_BID_ALL]):
        from env.board import BOARD, COLOR_GROUPS
        
        # Find the bidder
        if engine.auction_participants and engine.auction_bidder_idx < len(engine.auction_participants):
            bidder_idx = engine.auction_participants[engine.auction_bidder_idx]
        else:
            bidder_idx = engine.current_player
        bidder = engine.players[bidder_idx]
        
        prop_pos = engine.auction_property
        sq = BOARD[prop_pos]
        current_bid = engine.auction_current_bid
        
        # Calculate the max this bot should bid (the EV / valuation)
        max_bid = _property_valuation(state_dict, bidder_idx, prop_pos)
        
        # Never bid more than (balance - safety reserve)
        turn = state_dict.get("turn_number", 0)
        safety = 100 if turn < 30 else 200
        absolute_max = max(0, bidder.balance - safety)
        
        # If completing a monopoly, go all-in up to 2x price
        completes_monopoly = False
        if sq.color:
            group = COLOR_GROUPS.get(sq.color, [])
            owned_count = sum(1 for gp in group if engine.ownership[gp].owner == bidder_idx)
            if owned_count == len(group) - 1:
                completes_monopoly = True
                absolute_max = bidder.balance  # no safety reserve for monopoly completion
        
        # Blocking: if opponent is 1 away from monopoly, increase max bid
        blocking = False
        if sq.color:
            group = COLOR_GROUPS.get(sq.color, [])
            for opp_idx in range(len(engine.players)):
                if opp_idx == bidder_idx:
                    continue
                opp_owned = sum(1 for gp in group if engine.ownership[gp].owner == opp_idx)
                if opp_owned == len(group) - 1:
                    blocking = True
                    max_bid = max(max_bid, int(sq.price * 1.8))
        
        target_bid = min(max_bid, absolute_max)
        min_valid_bid = current_bid + 1
        
        print(f"[Bot] AUCTION: {sq.name} | current_bid=${current_bid} | EV=${max_bid} | target=${target_bid} | balance=${bidder.balance} | monopoly={completes_monopoly} | blocking={blocking}")
        
        # If we can't outbid or the target is below the current bid, pass
        if target_bid < min_valid_bid or bidder.balance < min_valid_bid:
            action = AUCTION_PASS
            print(f"[Bot] AUCTION: PASS (target ${target_bid} < min bid ${min_valid_bid})")
        else:
            # Pick the bid tier that gets closest to target_bid without overshooting
            bid_options = []
            if AUCTION_BID_MIN in legal:
                bid_options.append((AUCTION_BID_MIN, min_valid_bid))
            if AUCTION_BID_LOW in legal:
                bid_options.append((AUCTION_BID_LOW, max(min_valid_bid, int(bidder.balance * 0.15))))
            if AUCTION_BID_MED in legal:
                bid_options.append((AUCTION_BID_MED, max(min_valid_bid, int(bidder.balance * 0.30))))
            if AUCTION_BID_HIGH in legal:
                bid_options.append((AUCTION_BID_HIGH, max(min_valid_bid, int(bidder.balance * 0.60))))
            if AUCTION_BID_ALL in legal:
                bid_options.append((AUCTION_BID_ALL, bidder.balance))
            
            # Filter to bids within our target
            valid_bids = [(aid, amt) for aid, amt in bid_options if amt <= target_bid]
            
            if valid_bids:
                # Pick the highest bid that's still within target
                action, bid_amt = max(valid_bids, key=lambda x: x[1])
                print(f"[Bot] AUCTION: Bidding ${bid_amt} (action={action_names.get(action, '?')})")
            elif bid_options:
                # All options exceed target — use the smallest (BID_MIN)
                action, bid_amt = min(bid_options, key=lambda x: x[1])
                if bid_amt <= absolute_max:
                    print(f"[Bot] AUCTION: Min bid ${bid_amt} (all tiers exceed target)")
                else:
                    action = AUCTION_PASS
                    print(f"[Bot] AUCTION: PASS (even min bid ${bid_amt} exceeds absolute max ${absolute_max})")
            else:
                action = AUCTION_PASS
                print(f"[Bot] AUCTION: PASS (no valid bid options)")
        
        result = map_action_to_frontend(action)
        print(f"[Bot] -> {result.actionType}")
        return result

    # ══════════════════════════════════════════════════════════════════════════
    #  PHASE 3: Everything else — RL model (ROLL, END_TURN, BUILD, JAIL)
    # ══════════════════════════════════════════════════════════════════════════
    from env.state_encoder import encode_state
    obs = encode_state(state_dict, legal)
    obs_np = np.array(obs, dtype=np.float32)
    
    if _model_type == "ppo":
        from env.state_encoder import action_mask
        legal_mask = action_mask(legal)
        action, _ = _model.predict(obs_np, deterministic=True, action_masks=legal_mask)
        action = int(action)
        if action not in legal:
            action = legal[0]
    elif _model_type == "bc":
        with torch.no_grad():
            obs_t = torch.from_numpy(obs_np).unsqueeze(0).to(_device)
            legal_mask = torch.zeros(1, _n_actions, dtype=torch.bool, device=_device)
            for a in legal:
                if a < _n_actions:
                    legal_mask[0, a] = True
            actions, _, _ = _model.masked_action(obs_t, legal_mask, deterministic=True)
            action = int(actions[0].cpu().item())
    else:
        # Random fallback — but prefer BUILD actions if available
        build_actions = [a for a in legal if BUILD_BASE <= a < BUILD_BASE + 40]
        if build_actions:
            import random
            action = random.choice(build_actions)
        else:
            import random
            action = random.choice(legal)
    
    result = map_action_to_frontend(action)
    print(f"[Bot] -> Chose action_id={action} ({action_names.get(action, f'BUILD_{action-13}' if 13 <= action < 53 else '?')}) -> {result.actionType}")
    return result


# ── Property Valuation Helper ─────────────────────────────────────────────────

# Rough expected rental income per property over a full game (~80 turns, 4 players).
# Based on landing probability (~2.5% per square per opponent turn) × rent × remaining turns.
_VALUATION_CACHE: dict[tuple[int, int], int] = {}

def _property_valuation(state_dict: dict, player_idx: int, prop_pos: int) -> int:
    """Estimate the fair value of a property for a given player.
    
    Takes into account:
    - List price as baseline
    - Color group synergy (owning siblings boosts value)
    - Monopoly completion bonus (massive multiplier)
    - Railroad network effects
    - Game phase (early game = higher value since more turns to collect rent)
    """
    from env.board import BOARD, COLOR_GROUPS
    
    sq = BOARD[prop_pos]
    if sq.price == 0:
        return 0
    
    # Base valuation = list price (fair market value)
    base = sq.price
    
    turn = state_dict.get("turn_number", 0)
    # Turns remaining factor: more turns left = more rent collected = higher value
    remaining_factor = max(0.5, min(1.5, (120 - turn) / 80))
    
    if sq.type == "property" and sq.color:
        group = COLOR_GROUPS.get(sq.color, [])
        owned = sum(1 for gp in group if state_dict["ownership"].get(str(gp), {}).get("owner") == player_idx)
        total = len(group)
        
        if owned == total - 1:
            # Completes monopoly! Value = price + future hotel rent potential
            # A monopoly is worth ~3-5x the list price in expected rent
            hotel_rent = sq.rents[5] if len(sq.rents) >= 6 else sq.rents[-1]
            valuation = int(base * 2.0 + hotel_rent * 0.3)
        elif owned > 0:
            # Partial group — worth more than list to keep the dream alive
            valuation = int(base * 1.3)
        else:
            # First property in the group — worth list price
            valuation = base
    elif sq.type == "railroad":
        rr_positions = [5, 15, 25, 35]
        owned_rr = sum(1 for rp in rr_positions if state_dict["ownership"].get(str(rp), {}).get("owner") == player_idx)
        # Railroads get better the more you own: $25/$50/$100/$200 rent
        if owned_rr >= 2:
            valuation = int(base * 1.5)
        elif owned_rr >= 1:
            valuation = int(base * 1.2)
        else:
            valuation = base
    elif sq.type == "utility":
        valuation = int(base * 0.8)  # Utilities are generally weak
    else:
        valuation = base
    
    return int(valuation * remaining_factor)


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    import uvicorn
    import yaml

    cfg = {}
    cfg_path = Path(__file__).parent.parent / "config.yaml"
    if cfg_path.exists():
        with open(cfg_path) as f:
            cfg = yaml.safe_load(f) or {}
    server_cfg = cfg.get("server", {})

    host = os.getenv("SERVER_HOST", server_cfg.get("host", "0.0.0.0"))
    port = int(os.getenv("SERVER_PORT", server_cfg.get("port", 8765)))

    uvicorn.run("server.main:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    main()
