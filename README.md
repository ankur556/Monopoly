# Monopoly RL: Full-Stack Board Game with AI Bots

This project is a complete, full-stack implementation of the classic board game Monopoly. It features a modern, responsive web frontend built with React, and a powerful Reinforcement Learning (RL) backend built with Python, PyTorch, and Stable-Baselines3. 

The highlight of the project is the AI bots: agents trained using a combination of **Behavioral Cloning (BC)** and **Proximal Policy Optimization (PPO)** to play a deeply strategic game against humans or other bots.

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
- The FastAPI server (`server/main.py`) exposes a `/act_frontend` endpoint.
- **The Bridge:** When it is a bot's turn, the React frontend sends the entire Zustand JSON state to the backend. The backend reconstructs the `MonopolyEngine` locally, calculates exactly which actions are legal, runs the observation through the PPO neural network, and returns a translated command (e.g., `"BUY_PROPERTY"`) to the frontend.

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
- **Reward Shaping:** To prevent the agent from playing a "cowardly" or "pacifist" strategy (just walking around the board refusing to buy properties to avoid bankruptcy), we implemented a multi-agent **Relative Net-Worth** buffer. 
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
