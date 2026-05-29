import { useRef, type ReactNode } from "react";
import { getPositionAt } from "../../data/boardLayout";
import { useGameStore } from "../../store/gameStore";
import { BoardCenter } from "./BoardCenter";
import { BoardSquare } from "./BoardSquare";
import { TokenOverlay } from "./TokenOverlay";

const GRID_SIZE = 11;
const CORNERS = new Set([0, 10, 20, 30]);

export function Board() {
  const squares = useGameStore((s) => s.squares);
  const players = useGameStore((s) => s.players);
  const highlightedSquareId = useGameStore((s) => s.highlightedSquareId);

  const gridRef = useRef<HTMLDivElement>(null);
  const squareByIndex = new Map(squares.map((s) => [s.boardIndex, s]));

  const cells: ReactNode[] = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const position = getPositionAt(row, col);
      const isCenter = row >= 1 && row <= 9 && col >= 1 && col <= 9;

      if (isCenter) {
        if (row === 1 && col === 1) {
          cells.push(<BoardCenter key="center" />);
        }
        continue;
      }

      if (position !== null) {
        const square = squareByIndex.get(position);
        if (!square) continue;
        cells.push(
          <div
            key={`${row}-${col}`}
            className="min-h-0 min-w-0"
            style={{ gridRow: row + 1, gridColumn: col + 1 }}
          >
            <BoardSquare
              square={square}
              players={players}
              isCorner={CORNERS.has(position)}
              isHighlighted={highlightedSquareId === square.id}
            />
          </div>,
        );
      }
    }
  }

  return (
    <div className="aspect-square w-full">
      {/* Relative wrapper so TokenOverlay can be absolute inside it */}
      <div className="relative h-full w-full">
        <div
          ref={gridRef}
          className="grid h-full w-full gap-px bg-zinc-900/80"
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
          }}
        >
          {cells}
        </div>

        {/* Floating token overlay — always visible regardless of tile size */}
        <TokenOverlay boardRef={gridRef} />
      </div>
    </div>
  );
}
