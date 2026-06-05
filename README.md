# 🎲 Monopoly — Full-Stack Board Game with AI Bots

A complete, browser-based Monopoly game with intelligent AI opponents. Built with a React/TypeScript frontend and a Python RL backend, featuring a **3-tier hybrid AI system** that combines deterministic heuristics, Expected Value math, and reinforcement learning to play like a real human.

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
| **BUY** | Deterministic Heuristic | If the bot can afford the property and keep a safe cash reserve ($100 early / $200 mid / $300 late game), it **always buys**. If buying completes a monopoly, it buys regardless of reserve. |
| **AUCTION** | EV-Capped Heuristic | Each property has a calculated **Expected Value (EV)** based on list price, color group synergy, monopoly potential, blocking value, and game phase. Bots bid up to the EV but never drain cash below safety. Monopoly completion = all-in. |
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

2. **Stage 2 — PPO Self-Play:** The BC model was fine-tuned with Proximal Policy Optimization across 8 parallel environments. Reward shaping encourages property acquisition (+0.3), monopoly completion (+2.0), house building (+0.5), and heavily penalizes bankruptcy (−5.0).

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
