# Monopoly MVP

A web-based Monopoly clone built with React, Vite, Tailwind CSS, and Zustand.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — typecheck and production build
- `npm run preview` — preview the production build
- `npm run lint` — run ESLint

## Project structure

- `src/store/gameStore.ts` — Zustand game state (players, properties, dice, buy/rent)
- `src/components/Board/` — 40-square perimeter board UI
- `src/components/GamePanel/` — dice roll, buy/pass, player status
- `src/data/` — board layout and property seed data
- `src/types/` — shared TypeScript types

Designed for easy integration with a WebSocket backend later: UI reads only from the store actions and selectors.
