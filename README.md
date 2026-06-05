# Monopoly RL: Full-Stack Board Game with AI Bots

This project is a complete, full-stack implementation of the classic board game Monopoly. It features a modern, responsive web frontend built with React, and a powerful Reinforcement Learning (RL) backend built with Python, FastAPI, and PyTorch.

The highlight of the project is the AI bots: agents trained using a combination of **Behavioral Cloning (BC)** and **Proximal Policy Optimization (PPO)** to play a deeply strategic game against human players.

---

## 🏗️ Architecture

The project is split into two distinct halves that communicate via a REST API:

### 1. The Frontend (React / TypeScript / Zustand)
- Located in the root directory.
- Built using Vite, React, and TailwindCSS.
- Game state is managed by a massive, robust Zustand store (`gameStore.ts`).
- Handles all UI animations, dice rolls, card reveals, player balances, and human interaction.

### 2. The RL Backend (`/monopoly-rl`)
- Built in Python using FastAPI, PyTorch, and Stable-Baselines3.
- Contains a standalone, headless python `MonopolyEngine` that perfectly simulates the board game rules without a UI.
- The FastAPI server (`server/main.py`) exposes a `/act` endpoint.
- **The Bridge:** When it is a bot's turn, the React frontend sends the entire Zustand JSON state to the backend. The backend reconstructs the `MonopolyEngine` locally, calculates exactly which actions are legal, and uses the trained PPO model to select the best move.

---

## 🧠 How the AI was Trained

Training an RL agent to play Monopoly is notoriously difficult due to the massive observation space, delayed rewards, and strictly zero-sum multi-agent mechanics. We used a two-stage approach:

### Stage 1: Behavioral Cloning (BC) from an LLM
- We initially used a Large Language Model to play thousands of games against itself.
- We recorded the board states and the actions the LLM chose.
- We trained a baseline neural network (`models/bc/best_model.pt`) using supervised learning to simply mimic the LLM's understanding of the game.
- This gave the agent a foundational understanding of basic logic (e.g., buying properties is usually good, passing is usually bad) without having to stumble blindly through random exploration.

### Stage 2: PPO Self-Play
- We initialized a PPO (Proximal Policy Optimization) model with the weights from the BC model.
- We placed the agent in a custom Gymnasium environment (`MonopolyEnv`) where it played millions of steps of self-play.
- **Reward Shaping:** To prevent the agent from playing a "cowardly" or "pacifist" strategy (just walking around the board refusing to buy properties to avoid bankruptcy), we implemented a multi-agent reward function:
  - The agent is penalized `-0.005` points for every step it takes (to discourage stalling).
  - The agent receives dense positive rewards whenever an opponent pays it rent or goes bankrupt. 
- This forced the agent to become an aggressive capitalist, buying properties and building houses to bankrupt its opponents!

---

## 🚀 How to Run the Game Locally

To play the game against the RL bots, you must run both the Python backend and the React frontend simultaneously.

### 1. Start the RL Backend Server
The backend requires Python and PyTorch. It hosts the FastAPI model server.
```bash
# Navigate to the backend directory
cd monopoly-rl

# Install dependencies (if you haven't already)
pip install -r requirements.txt

# Start the FastAPI server on port 8765
python server/main.py
```
*Note: Ensure your trained models are located in `monopoly-rl/models/ppo/best_model.zip` or `monopoly-rl/models/bc/best_model.pt`.*

### 2. Start the Frontend App
Open a *new* terminal window in the root directory of the project.
```bash
# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

### 3. Play!
- Open your browser to `http://localhost:5173`.
- Click **Local Multiplayer**.
- In the lobby, use the **👤 HUMAN / 🤖 BOT** toggle to set up your game. You can play 1v1 against a bot, 1v3, or even have 6 bots play against each other while you watch!
- Click **Start Game** and enjoy!

---

## 📊 Monopoly RL Backend Details

### Observation Space (214-dimensional float32)

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

### Action Space (53 discrete actions)

| ID | Action |
|----|--------|
| 0 | Roll dice / end turn |
| 1 | Buy current property |
| 2–41 | Build house on property 0–39 |
| 42 | Sell house (cheapest) |
| 43–52 | Mortgage property 0–9 (grouped by colour) |
| 53 | Unmortgage property (cheapest) |

> Actions outside the legal mask are automatically blocked by the environment.

### Architecture Overview

```
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
```

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

## 🔬 Detailed Training Pipeline

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

## Backend Setup & Training

### Installation

```bash
cd monopoly-rl
pip install -r requirements.txt
```

**Key dependencies:**
- `torch` — Neural network framework
- `stable-baselines3`, `sb3-contrib` — PPO and MaskablePPO implementations
- `gymnasium` — RL environment standard
- `pydantic`, `fastapi` — REST API
- `groq` — LLM inference for data collection
- `wandb` — Experiment tracking (optional)
- `pyyaml` — Config file parsing

### Environment Configuration

```bash
cp .env.example .env
# Edit .env and add:
#   GROQ_API_KEY=sk-...
#   WANDB_API_KEY=...
```

---

## Project Structure

```
monopoly-rl/
├── agents/
│   ├── __init__.py
│   ├── llm_agent.py        # Groq-backed LLM agent for data collection
│   └── random_agent.py     # Baseline agent (random valid actions)
├── data/
│   ├── __init__.py
│   └── collector.py        # DataCollector: loads & aggregates .npz files
├── env/
│   ├── __init__.py
│   ├── game_engine.py      # MonopolyEngine: core game logic (no UI)
│   ├── monopoly_env.py     # MonopolyEnv: Gymnasium wrapper
│   └── action_masks.py     # Legal action computation
├── training/
│   ├── __init__.py
│   ├── policy_network.py   # PolicyNetwork: shared MLP (BC + PPO)
│   └── bc_trainer.py       # BCTrainer: behavioral cloning training loop
├── server/
│   ├── __init__.py
│   └── main.py             # FastAPI server: /act endpoint
├── models/                 # Saved checkpoints
│   ├── bc/                 # BC trained models
│   └── ppo/                # PPO trained models
├── data_collected/         # Collected game data from LLM (Stage 1)
├── collect_data.py         # CLI: run LLM data collection
├── train_bc.py             # CLI: behavioral cloning training
├── train_ppo.py            # CLI: PPO self-play training
├── config.yaml             # All hyperparameters (stages 1 & 2)
├── .env.example            # Environment variable template
└── requirements.txt        # Python dependencies
```

---

## Experiment Tracking

### Weights & Biases (W&B)

To enable experiment tracking and visualization:

1. **Sign up** at https://wandb.ai/
2. **Set your API key** in `.env`:
   ```
   WANDB_API_KEY=your_key_here
   ```
3. **Enable during training:**
   ```bash
   python train_bc.py --wandb
   python train_ppo.py --wandb
   ```

**Logged:**
- Training/validation loss & accuracy (BC)
- Episode rewards, policy loss, value loss, entropy (PPO)
- Hyperparameters used
- System metrics (GPU memory, training time)

Runs are automatically tagged to the `monopoly-rl` project.

### TensorBoard

PPO training also logs to TensorBoard:

```bash
tensorboard --logdir monopoly-rl/models/ppo/tb_logs/
```

Open `http://localhost:6006/` in your browser.

---

## Running the Model Server

After training completes, serve the model via FastAPI:

```bash
python -m server.main
```

The server listens on `http://0.0.0.0:8765` and exposes:

**Endpoint:** `POST /act`

**Request body:**
```json
{
  "state": [0.0, 0.1, ..., 0.5],    // 214-dim observation vector
  "legal_actions": [0, 1, 3, 5]     // list of valid action IDs
}
```

**Response:**
```json
{ "action": 1 }
```

The server automatically selects the best available model:
1. **PPO** (`models/ppo/best_model.zip`) if it exists → preferred
2. **BC fallback** (`models/bc/best_model.pt`) if PPO not found
3. **Random** if neither model exists

---

## ⚠️ Important: Next.js Breaking Changes

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code.

---

## License

MIT
