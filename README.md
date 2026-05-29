# Monopoly MVP

A high-fidelity web Monopoly clone built with React, Vite, TypeScript, Tailwind CSS 4, and Zustand.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Features

- **40-square board** — Classic color bands, property names, GO, Jail, Taxes, Chance, Community Chest, Free Parking, Go To Jail
- **Full property economics** — Base rent, 1–4 houses, hotel rents, railroad/utility scaling
- **Gameplay** — Dice movement, $200 for passing GO, buy/rent, color-set monopoly (2× base rent), house building with on-board icons
- **Economic ledger** — Transaction history in the control panel
- **Peer-to-peer trading** — Compose, send, accept, counter, and decline offers
- **Premium UI** — Isometric 3D board, glass panels, light/dark theme, readable dice with theme-aware contrast

## Scripts

- `npm run dev` — development server
- `npm run build` — typecheck + production build
- `npm run preview` — preview production build

## Architecture

| Path | Role |
|------|------|
| `src/data/boardDefinitions.ts` | All 40 squares + official rent tables |
| `src/store/gameStore.ts` | Zustand state, turn loop, trade machine |
| `src/lib/rent.ts` | Rent calculation, monopoly detection |
| `src/lib/building.ts` | Even-build house rules |
| `src/lib/executeTrade.ts` | Atomic trade settlement |

Ready for future WebSocket multiplayer, RL, and blockchain layers.
