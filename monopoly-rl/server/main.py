"""FastAPI model server — exposes the trained Monopoly agent over HTTP."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

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


# ── App setup ─────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Monopoly RL Model Server",
    description="Serves trained Monopoly RL agents via REST API.",
    version="1.0.0",
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
            from stable_baselines3 import PPO
            _model = PPO.load(str(ppo_p), device=device)
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
