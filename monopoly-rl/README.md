# Monopoly RL — Hybrid AI Backend

The reinforcement learning and heuristic AI backend for the Monopoly board game. This module contains a complete headless Monopoly engine, a 3-tier bot decision system, and the full training pipeline.

---

## How the Bot Decides

The bot uses a **3-tier hybrid architecture** — not a single neural network. Each game phase is routed to the most appropriate decision method:

```
              ┌─────────────────────────────────┐
              │     Frontend sends game state    │
              └──────────────┬──────────────────┘
                             ▼
              ┌─────────────────────────────────┐
              │   frontend_adapter.py            │
              │   Reconstruct MonopolyEngine     │
              │   Calculate legal actions        │
              └──────────────┬──────────────────┘
                             ▼
              ┌──────────────────────────────────┐
              │         Phase Router             │
              │                                  │
              │  BUY? ──────► Heuristic          │
              │  AUCTION? ──► EV-Capped Bidding  │
              │  OTHER? ────► PPO / BC Model     │
              └──────────────────────────────────┘
```

### Tier 1: BUY Phase — Deterministic Heuristic

No ML involved. The bot acts like a rational human player:

- **Early game (turn < 30):** Buy if balance − price ≥ $100
- **Mid game (turn 30–60):** Buy if balance − price ≥ $200
- **Late game (turn > 60):** Buy if balance − price ≥ $300
- **Monopoly completion:** Always buy, regardless of reserve

### Tier 2: AUCTION Phase — Expected Value Bidding

Each property has a dynamically calculated **Expected Value (EV)**:

```
EV = base_price × synergy_multiplier × game_phase_factor

Where:
  synergy_multiplier =
    2.0× + 30% hotel rent  (completes monopoly)
    1.3×                    (partial color group)
    1.5×                    (railroad, own 2+)
    0.8×                    (utility)
    1.0×                    (default)
    
  game_phase_factor = clamp((120 − turn) / 80, 0.5, 1.5)
```

The bot bids up to `min(EV, balance − safety_reserve)`. Special cases:
- **Monopoly completion:** No safety reserve (all-in)
- **Blocking opponent's monopoly:** EV boosted to max(EV, 1.8× price)

### Tier 3: ROLL / BUILD / END_TURN / JAIL — RL Model

A PPO neural network (trained via BC + self-play) handles the remaining decisions. The random fallback prefers BUILD actions when available.

---

## Training Pipeline

### Stage 1: Behavioral Cloning from LLM

An LLM (Groq llama-3.1-70b) plays thousands of simulated games. Its decisions are recorded and used to train a baseline policy network.

```bash
# Collect data (requires GROQ_API_KEY in .env)
python collect_data.py --n-games 200

# Train BC model
python train_bc.py
```

### Stage 2: PPO Self-Play

The BC policy is loaded into a MaskablePPO agent and fine-tuned via self-play.

```bash
# Train for 1M steps on GPU (~30-60 min on RTX 3090)
python train_ppo.py --total-timesteps 1000000 --device cuda
```

#### Reward Shaping

| Event | Reward |
|-------|--------|
| Each step (time penalty) | −0.005 |
| Buy a property | +0.3 |
| Complete a monopoly | +2.0 |
| Build a house | +0.5 |
| Win an auction | +0.1 |
| Receive rent (per $100) | +1.0 |
| Pay rent (per $100) | −1.0 |
| Go bankrupt | −5.0 |
| Win the game | +10.0 |
| Bankrupt an opponent | +5.0 |

---

## Observation Space (214-dim float32)

| Slice | Dims | Description |
|-------|------|-------------|
| 0–39 | 40 | Property ownership (owner_idx+1)/n_players, 0=unowned |
| 40–79 | 40 | House count / 5 |
| 80–119 | 40 | Mortgage status (0/1) |
| 120–125 | 6 | Player balances / 5000 |
| 126–131 | 6 | Player positions / 40 |
| 132–137 | 6 | In-jail flags |
| 138–143 | 6 | Jail turns / 3 |
| 144–149 | 6 | Bankrupt flags |
| 150–155 | 6 | GOOJF card count / 2 |
| 156 | 1 | Current player index / 6 |
| 157–158 | 2 | Last dice roll / 6 |
| 159–160 | 2 | Pending property position / 40 |
| 161–213 | 53 | Legal action mask |

---

## Action Space (53 discrete actions)

| ID | Action |
|----|--------|
| 0 | Roll dice |
| 1 | End turn |
| 2 | Buy property |
| 3 | Decline / start auction |
| 4 | Pay $50 jail fine |
| 5 | Use Get-Out-Of-Jail-Free card |
| 6 | Roll for doubles (jail) |
| 7 | Auction: pass |
| 8 | Auction: bid minimum ($1 above current) |
| 9 | Auction: bid 15% of balance |
| 10 | Auction: bid 30% of balance |
| 11 | Auction: bid 60% of balance |
| 12 | Auction: bid entire balance |
| 13–52 | Build house on property at position 0–39 |

> Actions outside the legal mask are blocked by the environment.

---

## Running the Server

```bash
python server/main.py
```

Starts on `http://0.0.0.0:8765`. Auto-loads: PPO → BC → random fallback.

### Endpoints

**POST /act_frontend** — Primary endpoint used by the game frontend.

Request: Full Zustand game state JSON.  
Response:
```json
{ "actionType": "BUY_PROPERTY", "payload": null }
```

**POST /act** — Raw observation endpoint for testing.

Request:
```json
{ "state": [0.0, ...], "legal_actions": [0, 1, 3] }
```
Response:
```json
{ "action": 1, "model_type": "ppo" }
```

---

## Project Structure

```
monopoly-rl/
├── agents/
│   ├── llm_agent.py         # Groq LLM agent (data collection + EV context)
│   └── random_agent.py      # Uniform-random baseline
├── env/
│   ├── board.py             # 40 squares, rent tables, color groups
│   ├── game_engine.py       # Complete headless Monopoly engine
│   ├── monopoly_env.py      # Gymnasium wrapper
│   └── state_encoder.py     # State → 214-dim observation
├── server/
│   ├── main.py              # FastAPI server + 3-tier decision router
│   └── frontend_adapter.py  # Zustand JSON → MonopolyEngine bridge
├── training/
│   ├── policy_network.py    # Neural network (shared trunk + heads)
│   └── bc_trainer.py        # Behavioral cloning trainer
├── data/
│   └── collector.py         # Multi-threaded game data collection
├── models/
│   ├── ppo/best_model.zip   # Trained PPO model
│   └── bc/best_model.pt     # Trained BC model
├── data_collected/           # BC training data (.npz)
├── collect_data.py           # CLI: data collection
├── train_bc.py               # CLI: behavioral cloning
├── train_ppo.py              # CLI: PPO training
├── config.yaml               # Hyperparameters
├── requirements.txt          # Python dependencies
└── .env.example              # Environment template
```

---

## Configuration

All hyperparameters are in `config.yaml`:

```yaml
behavioral_cloning:
  epochs: 50
  batch_size: 256
  lr: 3e-4
  early_stop_patience: 5

ppo:
  total_timesteps: 5000000
  n_envs: 8
  n_steps: 2048
  batch_size: 64
  learning_rate: 3e-4
  gamma: 0.99
  ent_coef: 0.05
  checkpoint_every: 100000
  eval_every: 50000
```

---

## License

MIT
