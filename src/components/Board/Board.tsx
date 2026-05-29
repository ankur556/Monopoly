import type { ReactNode } from "react";
import { getPositionAt } from "../../data/boardLayout";
import { useGameStore } from "../../store/gameStore";
import { BoardSquare } from "./BoardSquare";

const GRID_SIZE = 11;

export function Board() {
  const players = useGameStore((s) => s.players);
  const properties = useGameStore((s) => s.properties);

  const cells: ReactNode[] = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const position = getPositionAt(row, col);
      const isCenter =
        row >= 1 && row <= 9 && col >= 1 && col <= 9;

      if (isCenter) {
        if (row === 1 && col === 1) {
          cells.push(
            <div
              key="center"
              className="col-start-2 col-end-11 row-start-2 row-end-11 flex items-center justify-center bg-emerald-800 text-center text-lg font-bold tracking-widest text-white sm:text-2xl"
              style={{ gridColumn: "2 / 11", gridRow: "2 / 11" }}
            >
              MONOPOLY
            </div>,
          );
        }
        continue;
      }

      if (position !== null) {
        const property = properties.find((p) => p.boardIndex === position);
        cells.push(
          <div
            key={`${row}-${col}`}
            style={{ gridRow: row + 1, gridColumn: col + 1 }}
          >
            <BoardSquare
              position={position}
              property={property}
              players={players}
            />
          </div>,
        );
      }
    }
  }

  return (
    <div className="w-full max-w-[min(100vw-2rem,42rem)]">
      <div
        className="grid aspect-square w-full gap-px bg-zinc-500"
        style={{
          gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
        }}
      >
        {cells}
      </div>
    </div>
  );
}
