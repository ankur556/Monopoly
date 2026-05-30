# Monopoly RL

A two-stage reinforcement learning agent that learns to play Monopoly:

1. **Stage 1 — Behavioral Cloning (BC):** An LLM (Groq / llama-3.1-70b-versatile) plays thousands of games; its decisions are recorded as (state, action) pairs, then a neural network is trained via supervised learning to imitate them.
2. **Stage 2 — PPO Self-Play:** The BC-initialised policy is fine-tuned with Proximal Policy Optimisation (Stable-Baselines3) against copies of itself and occasional LLM opponents, enabling it to surpass its teacher.

---

## Architecture Overview

`
┌─────────────────────────────────────────────────────────────┐
│  Stage 1: Data Collection & Behavioral Cloning              │
│                                                             │
│  Groq LLM ──▶ MonopolyEnv ──▶ (state, action) pairs        │
│                                      │                      │
│                                      ▼                      │
│                               PolicyNetwork (BC)            │
│                              (supervised training)          │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼  initialise weights
┌─────────────────────────────────────────────────────────────┐
│  Stage 2: PPO Self-Play                                     │
│                                                             │
│  PolicyNetwork ──▶ SB3 PPO ──▶ self-play + LLM opponents   │
│                         │                                   │
│                         ▼                                   │
│                   best_model.zip                            │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  FastAPI Model Server  (port 8765)                          │
│  POST /act  { state, legal_actions } ──▶ { action }         │
└─────────────────────────────────────────────────────────────┘
`

---

## Observation Space (214-dimensional float32)

| Slice | Dims | Description |
|-------|------|-------------|
| [0:40] | 40 | Property ownership: −1 opponent, 0 unowned, 1 self |
| [40:80] | 40 | House/hotel count per property (0–5) |
| [80:120] | 40 | Mortgage status per property (0/1) |
| [120:124] | 4 | Each player's normalised cash balance (÷1500) |
| [124:128] | 4 | Each player's board position (÷40) |
| [128:132] | 4 | Each player's jail status (0/1) |
| [132:136] | 4 | Each player's jail-free-card count |
| [136:176] | 40 | Per-property rent owed if landed on (normalised) |
| [176:180] | 4 | Number of complete colour sets owned per player |
| [180:184] | 4 | Each player's bankruptcy status (0/1) |
| [184:188] | 4 | Number of properties owned per player |
| [188:192] | 4 | Rounds remaining (normalised, same for all players) |
| [192:214] | 22 | Current turn context (phase, dice values, pending trade, etc.) |

---

## Action Space (53 discrete actions)

| ID | Action |
|----|--------|
| 0 | Roll dice / end turn |
| 1 | Buy current property |
| 2–41 | Build house on property 0–39 |
| 42 | Sell house (cheapest) |
| 43–52 | Mortgage property 0–9 (grouped by colour) |
| 53 | Unmortgage property (cheapest) |

> Actions outside the legal mask are automatically blocked by the environment.

---

## Setup

### 1. Install dependencies

`ash
pip install -r requirements.txt
`

### 2. Configure environment

`ash
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
`

Recommended LLM: **llama-3.1-70b-versatile** via Groq — fast inference with strong strategic reasoning at low cost.

---

## Stage 1: Data Collection

`ash
python collect_data.py --n-games 1000
`

Options:

| Flag | Default | Description |
|------|---------|-------------|
| --n-games | 1000 | Number of full games to simulate |
| --n-workers | 4 | Parallel threads (LLM is the bottleneck) |
| --save-dir | data_collected | Output directory |
| --checkpoint-every | 50 | Save a checkpoint every N games |

Collected data is written to data_collected/ as compressed NumPy archives (.npz).

---

## Stage 1: Behavioral Cloning

`ash
python train_bc.py
`

Trains a PolicyNetwork on the collected (state, action) pairs. Checkpoints saved to models/bc/. The best validation-loss model is saved as models/bc/best_model.pt.

Key hyperparameters (configurable in config.yaml under ehavioral_cloning):

| Key | Default | Description |
|-----|---------|-------------|
| epochs | 50 | Training epochs |
| atch_size | 256 | Mini-batch size |
| lr | 3e-4 | Adam learning rate |
| early_stop_patience | 5 | Stop if val-loss doesn't improve |

---

## Stage 2: PPO Self-Play

`ash
python train_ppo.py
`

Loads BC weights into SB3's MlpPolicy, then trains with PPO for 5 M timesteps across 8 parallel environments. Checkpoints saved to models/ppo/.

Key hyperparameters (configurable in config.yaml under ppo):

| Key | Default |
|-----|---------|
| 	otal_timesteps | 5 000 000 |
| 
_envs | 8 |
| llm_opponent_prob | 0.3 |
| eval_every | 50 000 |

---

## Running the Model Server

`ash
python -m server.main
`

The FastAPI server listens on http://0.0.0.0:8765.

**Endpoint:** POST /act

Request body:
`json
{
   state: [0.0, ...],        // 214-dim observation
  legal_actions: [0, 1, 3]  // list of valid action IDs
}
`

Response:
`json
{ action: 1 }
`

The server auto-selects the best available model: PPO (models/ppo/best_model.zip) → BC fallback (models/bc/best_model.pt).

---

## Project Structure

`
monopoly-rl/
├── agents/
│   ├── __init__.py
│   ├── llm_agent.py        # Groq-backed LLM agent
│   └── random_agent.py     # Uniform-random baseline
├── data/
│   ├── __init__.py
│   └── collector.py        # Game data collection logic
├── training/
│   ├── __init__.py
│   ├── policy_network.py   # Neural network architecture
│   └── bc_trainer.py       # Behavioral cloning training loop
├── server/
│   ├── __init__.py
│   └── main.py             # FastAPI model server
├── models/                 # Saved model checkpoints
├── data_collected/         # Collected game data (Stage 1)
├── collect_data.py         # CLI: run LLM data collection
├── train_bc.py             # CLI: behavioral cloning training
├── train_ppo.py            # CLI: PPO self-play training
├── config.yaml             # All hyperparameters
├── .env.example            # Environment variable template
└── requirements.txt        # Python dependencies
`

---

## Experiment Tracking

Set WANDB_API_KEY in .env to enable Weights & Biases logging. Runs are tagged to the monopoly-rl project by default.

---

## License

MIT
