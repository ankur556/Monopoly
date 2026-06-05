# 🎲 Monopoly — Full-Stack Board Game with AI Bots

A complete, browser-based Monopoly game with intelligent AI opponents. Built with a React/TypeScript frontend and a Python RL backend, featuring a **3-tier hybrid AI system** that combines deterministic heuristics, Expected Value bidding, and reinforcement learning.

![Monopoly](https://img.shields.io/badge/Game-Monopoly-red?style=for-the-badge)
![React](https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-blue?style=for-the-badge)
![Python](https://img.shields.io/badge/Backend-Python%20%2B%20PyTorch-green?style=for-the-badge)

---

## ✨ Features

- **Full Monopoly Rules** — Property buying, rent collection, houses/hotels, auctions, mortgages, jail, Chance & Community Chest cards, bankruptcy, and win detection.
- **Up to 6 Players** — Any mix of humans and AI bots.
- **Animated UI** — 3D dice rolls, smooth token movement, card reveals, and turn-by-turn announcements.
- **Smart AI Bots** — A hybrid system that buys properties like a human, bids intelligently in auctions using Expected Value, and builds houses strategically via reinforcement learning.
- **Lobby System** — Toggle any player between 👤 Human and 🤖 Bot before starting.

---

## 🏗️ Architecture

The project is split into two halves that communicate via a REST API:

```
┌──────────────────────────────────────────────────────────────┐
│  FRONTEND  (React / TypeScript / Zustand)                    │
│                                                              │
│  Board UI ◄──► GameStore (Zustand) ──► useBotTurn hook       │
│                                              │               │
│                                    POST /act_frontend        │
└──────────────────────────────────────┬───────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────┐
│  BACKEND  (Python / FastAPI / PyTorch)                        │
│                                                              │
│  Frontend JSON ──► frontend_adapter.py ──► MonopolyEngine    │
│                                                  │           │
│                              ┌────────────────────┤           │
│                              ▼                    ▼           │
│                     Heuristic Layer         RL Model (PPO)    │
│                   (BUY + AUCTION)        (ROLL / BUILD /     │
│                                           END_TURN / JAIL)   │
└──────────────────────────────────────────────────────────────┘
```

### The 3-Tier Decision System

| Phase | Handler | How It Works |
|-------|---------|-------------|
| **BUY** | Deterministic Heuristic | If the bot can afford the property and keep a safe cash reserve ($100 early / $200 mid / $300 late game), it **always buys**. If buying completes a monopoly, it goes all-in. |
| **AUCTION** | EV-Capped Heuristic | Each property has a calculated **Expected Value (EV)** based on list price, color group synergy, monopoly potential, blocking value, and game phase. Bots bid up to their EV limit. |
| **ROLL / BUILD / END_TURN / JAIL** | PPO Neural Network | A reinforcement learning model trained via Behavioral Cloning + PPO self-play handles movement decisions and house building strategy. |

---

## 🧠 How the AI Works

### Property Valuation (Expected Value)

Every property has a dynamically calculated EV that the bot uses to decide whether to buy or how much to bid:

| Scenario | Valuation |
|----------|-----------|
| First property in a color group | 1.0× list price |
| Already own 1+ in the group | 1.3× list price |
| **Completes a monopoly** | **2.0× price + 30% of hotel rent** |
| Railroad (own 2+) | 1.5× list price |
| Utility | 0.8× list price |
| **Blocks opponent's monopoly** | max(EV, 1.8× price) |

All valuations are scaled by a **game-phase factor** — properties are worth more early game (more turns to collect rent) and less late game.

### Auction Bidding Logic

When a property goes to auction (either because a player declined to buy, or during a bankruptcy sale):

1. Calculate the EV of the property for this bidder.
2. Determine the **absolute max bid** = balance − safety reserve.
3. If completing a monopoly: no safety reserve (go all-in).
4. If blocking an opponent's monopoly: boost max bid to 1.8× list price.
5. Pick the highest bid tier (MIN / LOW / MED / HIGH / ALL) that stays within the target.
6. If the current bid already exceeds the EV: **pass**.

### RL Training Pipeline

The PPO model was trained in two stages:

1. **Stage 1 — Behavioral Cloning:** A Groq LLM (llama-3.1-70b) played thousands of games. Its decisions were recorded as (state, action) pairs and used to train a baseline neural network via supervised learning.

2. **Stage 2 — PPO Self-Play:** The BC model was fine-tuned with Proximal Policy Optimization across 8 parallel environments. Reward shaping encourages property acquisition (+0.3), monopoly completion (+2.0), building houses (+0.5), and winning (+10.0).

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+ with pip
- A **Groq API key** (free at [console.groq.com](https://console.groq.com)) — only needed for data collection, not for playing

### 1. Install Frontend Dependencies

```bash
cd monopoly
npm install
```

### 2. Install Backend Dependencies

```bash
cd monopoly-rl
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cd monopoly-rl
cp .env.example .env
# Edit .env and add your GROQ_API_KEY (only needed for training)
```

### 4. Start the Backend Server

```bash
cd monopoly-rl
python server/main.py
```

The FastAPI server starts on `http://0.0.0.0:8765`. It auto-loads the best available model: PPO → BC → random fallback.

### 5. Start the Frontend

Open a **new terminal**:

```bash
cd monopoly
npm run dev
```

### 6. Play!

- Open `http://localhost:5173`
- Click **Local Multiplayer**
- Toggle players between 👤 **Human** and 🤖 **Bot**
- Click **Start Game** and enjoy!

---

## 🔄 Retraining the AI

If you want to retrain the bots from scratch:

```bash
cd monopoly-rl

# 1. Collect behavioral cloning data (requires GROQ_API_KEY)
python collect_data.py --n-games 200

# 2. Train the BC baseline
python train_bc.py

# 3. Train PPO (1M steps on a GPU takes ~30-60 min)
python train_ppo.py --total-timesteps 1000000 --device cuda
```

| Flag | Default | Description |
|------|---------|-------------|
| `--total-timesteps` | 5,000,000 | Total PPO training steps |
| `--device` | cpu | `cuda` for GPU training |
| `--n-envs` | 8 | Parallel training environments |

---

## 📊 Detailed Training Pipeline

### Stage 1: Data Collection & Behavioral Cloning

#### 1.1 LLM Data Collection

The first step collects human-like gameplay from an LLM (Groq's llama-3.1-70b-versatile):

```bash
python collect_data.py --n-games 1000 --n-workers 4
```

**What happens:**
- The script spawns 4 parallel worker threads.
- Each worker initializes a `MonopolyEnv` and lets the LLM play full games.
- **At each decision point:** The current board state (214-dim observation) is sent to the LLM as a structured prompt. The LLM reasons about the best move and returns an action ID.
- **All (state, action) pairs are recorded** as compressed NumPy archives (.npz) in `data_collected/`.

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| --n-games | 1000 | Number of full games to simulate |
| --n-workers | 4 | Parallel threads (LLM is the bottleneck) |
| --save-dir | data_collected | Output directory |
| --checkpoint-every | 50 | Save a checkpoint every N games |

**Output:** Each checkpoint saves ~1,000 (state, action) pairs in compressed NumPy format. For 1,000 games with 4-player matches, expect ~50,000–100,000 total decision steps.

#### 1.2 Behavioral Cloning Training

Once data is collected, train a neural network to mimic the LLM's decisions:

```bash
python train_bc.py --epochs 50 --batch-size 256 --lr 3e-4
```

**Training loop (`training/bc_trainer.py`):**

1. **Load all collected data** from .npz files into a PyTorch Dataset.
2. **Split into train/val** (default 90/10 split).
3. **For each epoch:**
   - Forward pass through the network: `obs → trunk → policy_head → logits` (53 action logits)
   - Compute cross-entropy loss: `loss = -log(softmax(logits)[true_action])`
   - Backprop, gradient clipping (norm 1.0), Adam optimizer step.
   - Evaluate on validation set; track both **loss** and **accuracy**.
4. **Early stopping:** If validation loss doesn't improve for 5 epochs, training stops.
5. **Save best model** as `models/bc/best_model.pt` (checkpoint with lowest validation loss).

**Key hyperparameters** (configurable in `config.yaml`):

| Key | Default | Description |
|-----|---------|-------------|
| epochs | 50 | Maximum training epochs |
| batch_size | 256 | Mini-batch size |
| lr | 3e-4 | Adam learning rate |
| val_split | 0.1 | Fraction of data for validation |
| early_stop_patience | 5 | Epochs of no improvement before stopping |
| hidden | 512 | Hidden layer width |

**Expected performance:**
- Training typically converges in 10–25 epochs.
- Final validation accuracy: ~70–85% (the LLM's decisions are complex; perfect imitation is impossible).
- Loss decreases smoothly with a cosine annealing learning rate schedule.

**W&B Integration (optional):**
```bash
python train_bc.py --wandb
```
This logs training curves, accuracy, and hyperparameters to Weights & Biases.

---

### Neural Network Architecture

The policy network is a deep MLP shared between BC and PPO training:

```
Input: 214-dim observation
    │
    ├─ Linear(214 → 512) + LayerNorm + ReLU
    │
    ├─ Linear(512 → 512) + LayerNorm + ReLU
    │
    ├─ Linear(512 → 256) + LayerNorm + ReLU
    │
    ├─ Policy Head: Linear(256 → 53)  ← action logits (one per action)
    │
    └─ Value Head: Linear(256 → 1)    ← state value (for PPO advantage calculation)
```

**Key design choices:**
- **Layer Normalization:** Stabilizes training and reduces internal covariate shift.
- **Orthogonal Initialization:** Standard for RL—helps with gradient flow and stability.
- **Dual Heads:** The shared trunk extracts features; policy head produces action logits, value head estimates discounted future reward.
- **Gradient Clipping:** Applied during BC training to prevent exploding gradients.

---

### Stage 2: PPO Self-Play Training

After BC training completes, refine the policy using Proximal Policy Optimization (PPO):

```bash
python train_ppo.py --total-timesteps 5000000 --n-envs 8
```

**Overview:**
- **Initializes** the PPO policy with BC weights (transfer learning).
- **Runs 8 parallel game environments** simultaneously.
- **Agents play self-play** for 5 million timesteps (~500K games with 4 players each).
- **Rewards shaped** to encourage aggressive, strategic play.

#### 2.1 PPO Algorithm Overview

PPO is a policy gradient method that:
1. Collects experience by running the current policy in the environment.
2. Estimates advantages (how much better an action was vs. expected) using Generalized Advantage Estimation (GAE).
3. Updates the policy using a clipped objective to prevent too-large updates.
4. Also trains a value network to estimate state values (used for advantage calculation).

**In pseudocode:**
```
For each training iteration:
  - Collect n_steps=2048 transitions from each of 8 environments (16K transitions total)
  - Compute advantages using GAE (λ=0.95)
  - For n_epochs=10:
      - Split transitions into mini-batches of 64
      - Compute policy loss (with clipping) + value loss + entropy bonus
      - Backprop and update policy & value networks
```

#### 2.2 Key Hyperparameters (Stable-Baselines3 PPO)

| Key | Default | Description |
|-----|---------|-------------|
| total_timesteps | 5,000,000 | Total environment interactions |
| n_envs | 8 | Parallel game instances |
| n_steps | 2048 | Rollout length per environment |
| batch_size | 64 | Mini-batch size for gradient updates |
| n_epochs | 10 | Passes over collected experience |
| learning_rate | 3e-4 | Policy optimizer (Adam) learning rate |
| gamma | 0.99 | Discount factor (future rewards) |
| gae_lambda | 0.95 | GAE smoothing parameter |
| clip_range | 0.2 | PPO clipping range (ε in the paper) |
| ent_coef | 0.05 | Entropy bonus coefficient (encourages exploration) |

All these are configurable in `config.yaml` under the `ppo` section.

#### 2.3 Reward Shaping for Aggressive Play

To prevent "cowardly" strategies, the reward function is:

```
r_t = 
  - 0.005 * (every timestep penalty to discourage long games)
  + 1.0 * (if opponent goes bankrupt)
  + 0.5 * (if opponent pays me rent)
  + 0.1 * (if I buy a property)
  + 0.05 * (per complete color set I own)
```

This encourages:
- **Fast, aggressive play** (penalty for stalling)
- **Bankrupting opponents** (large +1.0 reward)
- **Collecting rent** (dense feedback when opponents land on my properties)
- **Strategic property development** (bonuses for complete sets)

#### 2.4 Weight Transfer from BC to PPO

When starting PPO training:
1. Load the trained BC network (`models/bc/best_model.pt`).
2. Extract its state dict (all layer weights and biases).
3. Load into Stable-Baselines3's MlpPolicy (which has a similar but not identical architecture).
4. **Partial weight transfer:** Only copy weights for layers with matching shapes/names.
5. Remaining untrained layers use orthogonal initialization.

This **warm-start** dramatically reduces training time (PPO doesn't need to learn basic game logic from scratch).

#### 2.5 Callbacks & Evaluation

During training, two callbacks monitor progress:

1. **CheckpointCallback:** Saves model snapshots every 100K timesteps to `models/ppo/ppo_checkpoint_*.zip`.
2. **EvalCallback:** Every 50K timesteps, runs 20 evaluation episodes (deterministic rollouts) and saves the best model as `models/ppo/best_model.zip`.

**Training output:**
```
| Timestep   | Reward | Policy Loss | Value Loss | Entropy | Time  |
|------------|--------|-------------|------------|---------|-------|
| 0          | -0.05  | 1.234       | 0.678      | 3.50    | 0.5s  |
| 100000     | 0.12   | 0.567       | 0.234      | 2.80    | 45s   |
| 1000000    | 0.45   | 0.123       | 0.056      | 1.20    | 450s  |
| 5000000    | 0.78   | 0.045       | 0.012      | 0.85    | 2250s |
```

Expected training time: **4–8 hours** on a modern GPU (NVIDIA A100/RTX 3090).

#### 2.6 TensorBoard & W&B Logging

Optional experiment tracking:

```bash
# Enable W&B logging (requires WANDB_API_KEY in .env)
python train_ppo.py --wandb

# Or view TensorBoard logs
tensorboard --logdir models/ppo/tb_logs/
```

Logged metrics:
- Episode reward (cumulative return per game)
- Policy loss & value loss
- Entropy (exploration indicator)
- Explained variance (how well the value network predicts returns)

---

## 📁 Project Structure

```
monopoly/
├── src/
│   ├── components/
│   │   ├── Board/          # Game board, squares, tokens, title deeds
│   │   ├── Dice/           # 3D animated dice
│   │   ├── GamePanel/      # Player info, action buttons, auction UI
│   │   ├── Menu/           # Main menu, lobby, player setup
│   │   ├── Trade/          # Trade offer/response UI
│   │   └── ui/             # Shared UI primitives
│   ├── hooks/
│   │   └── useBotTurn.ts   # React hook that triggers bot actions
│   ├── lib/
│   │   └── botClient.ts    # HTTP client for bot ↔ backend communication
│   ├── store/
│   │   └── gameStore.ts    # Zustand store — all game state & actions
│   └── types/
│       └── game.ts         # TypeScript type definitions
│
├── monopoly-rl/
│   ├── agents/
│   │   └── llm_agent.py    # Groq LLM agent (used for data collection)
│   ├── env/
│   │   ├── board.py        # All 40 squares with complete rent tables
│   │   ├── game_engine.py  # Full headless Monopoly engine
│   │   ├── monopoly_env.py # Gymnasium wrapper
│   │   └── state_encoder.py # State → 214-dim observation vector
│   ├── server/
│   │   ├── main.py         # FastAPI server + 3-tier decision system
│   │   └── frontend_adapter.py # Zustand JSON → MonopolyEngine bridge
│   ├── training/
│   │   ├── policy_network.py   # Neural network architecture
│   │   └── bc_trainer.py       # Behavioral cloning trainer
│   ├── models/             # Saved model checkpoints
│   ├── data_collected/     # BC training data (.npz)
│   ├── collect_data.py     # CLI: LLM data collection
│   ├── train_bc.py         # CLI: behavioral cloning
│   ├── train_ppo.py        # CLI: PPO self-play
│   └── config.yaml         # All hyperparameters
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Zustand, Vite |
| Backend | Python, FastAPI, PyTorch |
| RL Framework | Stable-Baselines3, sb3-contrib (MaskablePPO) |
| LLM (training only) | Groq API (llama-3.1-70b-versatile) |
| Communication | REST API (JSON over HTTP) |

---

## 📜 License

MIT
