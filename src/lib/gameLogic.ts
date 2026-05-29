import type { Property } from "../types/game";

export function rollDice(): number {
  return Math.floor(Math.random() * 11) + 2;
}

export function getPropertyAtIndex(
  properties: Property[],
  boardIndex: number,
): Property | undefined {
  return properties.find((p) => p.boardIndex === boardIndex);
}
