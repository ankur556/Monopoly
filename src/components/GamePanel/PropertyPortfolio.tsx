import { getBuildableSquares } from "../../lib/building";
import { useGameStore } from "../../store/gameStore";
import type { BoardSquare } from "../../types/game";

/** Maps color group to a Tailwind color for the group chip */
const GROUP_CHIP_STYLE: Record<string, { bg: string; text: string }> = {
  brown: { bg: "bg-[#8B4513]", text: "text-white" },
  "light-blue": { bg: "bg-[#87CEEB]", text: "text-zinc-900" },
  pink: { bg: "bg-[#FF69B4]", text: "text-white" },
  orange: { bg: "bg-[#FF8C00]", text: "text-white" },
  red: { bg: "bg-[#DC143C]", text: "text-white" },
  yellow: { bg: "bg-[#FFD700]", text: "text-zinc-900" },
  green: { bg: "bg-[#228B22]", text: "text-white" },
  "dark-blue": { bg: "bg-[#00008B]", text: "text-white" },
  railroad: { bg: "bg-zinc-800", text: "text-white" },
  utility: { bg: "bg-zinc-400", text: "text-zinc-900" },
};

function HouseIcons({ count }: { count: number }) {
  if (count === 0) return <span className="text-[10px] text-zinc-400">No buildings</span>;
  if (count >= 5) return <span className="text-sm">🏨</span>;
  return (
    <span className="text-sm">{"🏠".repeat(count)}</span>
  );
}

interface PropertyRowProps {
  square: BoardSquare;
  canBuild: boolean;
  onBuild: (id: string) => void;
}

function PropertyRow({ square, canBuild, onBuild }: PropertyRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-white/8 px-2 py-1.5 transition hover:bg-white/12">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold leading-tight">{square.name}</p>
        <div className="mt-0.5">
          <HouseIcons count={square.houses} />
        </div>
      </div>
      {canBuild && (
        <button
          id={`portfolio-build-${square.id}`}
          type="button"
          onClick={() => onBuild(square.id)}
          className="shrink-0 rounded-lg bg-amber-500 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow transition hover:bg-amber-400 active:scale-95"
        >
          +🏠 ${square.houseCost}
        </button>
      )}
    </div>
  );
}

/**
 * Property Portfolio — shows all properties owned by the current player,
 * grouped by color set, with Build House buttons accessible at any time.
 */
export function PropertyPortfolio() {
  const squares = useGameStore((s) => s.squares);
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const buildHouse = useGameStore((s) => s.buildHouse);
  const isMoving = useGameStore((s) => s.isMoving);
  const isRolling = useGameStore((s) => s.isRolling);
  const pendingAction = useGameStore((s) => s.pendingAction);

  const currentPlayer = players[currentPlayerIndex];
  const ownedSquares = squares.filter(
    (sq) =>
      sq.ownerId === currentPlayer.id &&
      (sq.type === "property" || sq.type === "railroad" || sq.type === "utility"),
  );

  if (ownedSquares.length === 0) return null;

  // Group by colorGroup
  const groups: Record<string, BoardSquare[]> = {};
  for (const sq of ownedSquares) {
    const key = sq.colorGroup ?? sq.type;
    if (!groups[key]) groups[key] = [];
    groups[key].push(sq);
  }

  const buildable = new Set(
    getBuildableSquares(squares, currentPlayer.id).map((s) => s.id),
  );
  const blocked = isMoving || isRolling || !!pendingAction;

  return (
    <div className="rounded-xl border border-white/15 bg-black/20 p-3 backdrop-blur-sm">
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-emerald-300/80">
        📋 My Portfolio — {currentPlayer.name}
      </p>

      <div className="flex flex-col gap-2">
        {Object.entries(groups).map(([group, props]) => {
          const chip = GROUP_CHIP_STYLE[group] ?? { bg: "bg-zinc-600", text: "text-white" };
          const label = group.replace("-", " ").toUpperCase();
          const groupHasBuildable = props.some((p) => buildable.has(p.id));

          return (
            <div key={group} className="animate-portfolio-slide">
              {/* Color group header chip */}
              <div className={`mb-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${chip.bg} ${chip.text}`}>
                {label}
                {groupHasBuildable && !blocked && (
                  <span className="rounded-full bg-white/25 px-1 py-px text-[8px]">
                    CAN BUILD
                  </span>
                )}
              </div>

              {/* Properties in this group */}
              <div className="flex flex-col gap-1">
                {props.map((sq) => (
                  <PropertyRow
                    key={sq.id}
                    square={sq}
                    canBuild={buildable.has(sq.id) && !blocked}
                    onBuild={buildHouse}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
