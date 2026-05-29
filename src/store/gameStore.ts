import { create } from "zustand";
import { INITIAL_PROPERTIES } from "../data/properties";
import { getPropertyAtIndex, rollDice as generateDiceRoll } from "../lib/gameLogic";
import type { PendingAction, Player, Property } from "../types/game";

interface GameState {
  players: Player[];
  properties: Property[];
  currentPlayerIndex: number;
  lastRoll: number | null;
  pendingAction: PendingAction;
  message: string;
  rollDice: () => void;
  buyProperty: () => void;
  declineBuy: () => void;
  endTurn: () => void;
}

const INITIAL_PLAYERS: Player[] = [
  { id: "p1", name: "Player 1", balance: 1500, position: 0 },
  { id: "p2", name: "Player 2", balance: 1500, position: 0 },
];

function nextPlayerIndex(current: number): number {
  return (current + 1) % 2;
}

export const useGameStore = create<GameState>((set, get) => ({
  players: INITIAL_PLAYERS.map((p) => ({ ...p })),
  properties: INITIAL_PROPERTIES.map((p) => ({ ...p })),
  currentPlayerIndex: 0,
  lastRoll: null,
  pendingAction: null,
  message: "Roll the dice to begin.",

  endTurn: () => {
    set({
      currentPlayerIndex: nextPlayerIndex(get().currentPlayerIndex),
      lastRoll: null,
      pendingAction: null,
    });
  },

  rollDice: () => {
    const state = get();
    if (state.pendingAction) return;

    const roll = generateDiceRoll();
    const playerIndex = state.currentPlayerIndex;
    const player = state.players[playerIndex];
    const newPosition = (player.position + roll) % 40;
    const players = state.players.map((p, i) =>
      i === playerIndex ? { ...p, position: newPosition } : p,
    );

    const property = getPropertyAtIndex(state.properties, newPosition);

    if (property?.ownerId && property.ownerId !== player.id) {
      const owner = state.players.find((p) => p.id === property.ownerId)!;
      const rent = Math.min(property.rent, player.balance);
      const updatedPlayers = players.map((p) => {
        if (p.id === player.id) return { ...p, balance: p.balance - rent };
        if (p.id === owner.id) return { ...p, balance: p.balance + rent };
        return p;
      });

      set({
        players: updatedPlayers,
        lastRoll: roll,
        message: `${player.name} paid $${rent} rent to ${owner.name} for ${property.name}.`,
      });
      get().endTurn();
      return;
    }

    if (property && !property.ownerId) {
      set({
        players,
        lastRoll: roll,
        pendingAction: { type: "buy", propertyId: property.id },
        message: `${player.name} landed on ${property.name} ($${property.price}). Buy or pass?`,
      });
      return;
    }

    const squareLabel = property?.name ?? `square ${newPosition}`;
    set({
      players,
      lastRoll: roll,
      message: `${player.name} rolled ${roll} and landed on ${squareLabel}.`,
    });
    get().endTurn();
  },

  buyProperty: () => {
    const state = get();
    const pending = state.pendingAction;
    if (!pending || pending.type !== "buy") return;

    const property = state.properties.find((p) => p.id === pending.propertyId);
    if (!property) return;

    const player = state.players[state.currentPlayerIndex];
    if (player.balance < property.price) {
      set({ message: `${player.name} cannot afford ${property.name}.` });
      get().declineBuy();
      return;
    }

    set({
      players: state.players.map((p, i) =>
        i === state.currentPlayerIndex
          ? { ...p, balance: p.balance - property.price }
          : p,
      ),
      properties: state.properties.map((p) =>
        p.id === property.id ? { ...p, ownerId: player.id } : p,
      ),
      pendingAction: null,
      message: `${player.name} bought ${property.name} for $${property.price}.`,
    });
    get().endTurn();
  },

  declineBuy: () => {
    const state = get();
    const player = state.players[state.currentPlayerIndex];
    set({
      pendingAction: null,
      message: `${player.name} passed on the purchase.`,
    });
    get().endTurn();
  },
}));

export function useCurrentPlayer(): Player {
  return useGameStore(
    (s) => s.players[s.currentPlayerIndex],
  );
}
