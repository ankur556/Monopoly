export interface GridCell {
  row: number;
  col: number;
}

/** Clockwise Monopoly path on an 11×11 grid (GO at bottom-right). */
export const POSITION_TO_CELL: Record<number, GridCell> = {
  0: { row: 10, col: 10 },
  1: { row: 10, col: 9 },
  2: { row: 10, col: 8 },
  3: { row: 10, col: 7 },
  4: { row: 10, col: 6 },
  5: { row: 10, col: 5 },
  6: { row: 10, col: 4 },
  7: { row: 10, col: 3 },
  8: { row: 10, col: 2 },
  9: { row: 10, col: 1 },
  10: { row: 10, col: 0 },
  11: { row: 9, col: 0 },
  12: { row: 8, col: 0 },
  13: { row: 7, col: 0 },
  14: { row: 6, col: 0 },
  15: { row: 5, col: 0 },
  16: { row: 4, col: 0 },
  17: { row: 3, col: 0 },
  18: { row: 2, col: 0 },
  19: { row: 1, col: 0 },
  20: { row: 0, col: 0 },
  21: { row: 0, col: 1 },
  22: { row: 0, col: 2 },
  23: { row: 0, col: 3 },
  24: { row: 0, col: 4 },
  25: { row: 0, col: 5 },
  26: { row: 0, col: 6 },
  27: { row: 0, col: 7 },
  28: { row: 0, col: 8 },
  29: { row: 0, col: 9 },
  30: { row: 0, col: 10 },
  31: { row: 1, col: 10 },
  32: { row: 2, col: 10 },
  33: { row: 3, col: 10 },
  34: { row: 4, col: 10 },
  35: { row: 5, col: 10 },
  36: { row: 6, col: 10 },
  37: { row: 7, col: 10 },
  38: { row: 8, col: 10 },
  39: { row: 9, col: 10 },
};

const cellToPosition = new Map<string, number>();

for (const [position, cell] of Object.entries(POSITION_TO_CELL)) {
  cellToPosition.set(`${cell.row},${cell.col}`, Number(position));
}

export function getPositionAt(row: number, col: number): number | null {
  return cellToPosition.get(`${row},${col}`) ?? null;
}

export const CORNER_LABELS: Partial<Record<number, string>> = {
  0: "GO",
  10: "Jail",
  20: "Free Parking",
  30: "Go To Jail",
};
