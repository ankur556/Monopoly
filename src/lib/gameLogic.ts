import type { BoardSquare } from "../types/game";

export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
}

export function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function getSquareAtIndex(
  squares: BoardSquare[],
  boardIndex: number,
): BoardSquare | undefined {
  return squares.find((s) => s.boardIndex === boardIndex);
}

/** @deprecated */
export function getPropertyAtIndex(
  squares: BoardSquare[],
  boardIndex: number,
): BoardSquare | undefined {
  return getSquareAtIndex(squares, boardIndex);
}
