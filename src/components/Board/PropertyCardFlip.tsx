import { useEffect } from "react";
import { COLOR_GROUP_MEMBERS } from "../../data/boardDefinitions";
import { canBuildOn } from "../../lib/building";
import { ownsColorSet } from "../../lib/rent";
import { useGameStore } from "../../store/gameStore";
import { GlassPanel } from "../ui/GlassPanel";

export function PropertyCardFlip() {
  const selectedPropertyId = useGameStore((s) => s.selectedPropertyId);
  const propertyCardFlipped = useGameStore((s) => s.propertyCardFlipped);
  const squares = useGameStore((s) => s.squares);
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const setSelectedPropertyId = useGameStore((s) => s.setSelectedPropertyId);
  const setPropertyCardFlipped = useGameStore((s) => s.setPropertyCardFlipped);
  const buildHouse = useGameStore((s) => s.buildHouse);

  const square = squares.find((s) => s.id === selectedPropertyId);
  const owner = square?.ownerId
    ? players.find((p) => p.id === square.ownerId)
    : null;
  const currentPlayer = players[currentPlayerIndex];
  const canBuild =
    square &&
    canBuildOn(square, squares, currentPlayer.id) &&
    square.ownerId === currentPlayer.id;

  const hasMonopoly =
    square?.colorGroup &&
    square.ownerId &&
    ownsColorSet(
      squares,
      square.ownerId,
      square.colorGroup,
      COLOR_GROUP_MEMBERS[square.colorGroup] ?? [],
    );

  useEffect(() => {
    if (!selectedPropertyId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedPropertyId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedPropertyId, setSelectedPropertyId]);

  if (!square || square.type === "go" || square.type === "chance") return null;
  if (
    square.type !== "property" &&
    square.type !== "railroad" &&
    square.type !== "utility"
  ) {
    return null;
  }

  const rent = square.rent;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={() => setSelectedPropertyId(null)}
      role="presentation"
    >
      <div
        className="perspective-1000 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Property card: ${square.name}`}
      >
        <div
          className={`preserve-3d relative min-h-64 w-full transition-transform duration-500 ${propertyCardFlipped ? "[transform:rotateY(180deg)]" : ""}`}
        >
          <GlassPanel className="backface-hidden absolute inset-0 flex flex-col gap-3 p-5">
            <div>
              <p className="text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                {square.colorGroup?.replace("-", " ") ?? square.type}
              </p>
              <h3 className="text-xl font-bold">{square.name}</h3>
              <p className="mt-1 text-sm opacity-80">
                Price: ${square.price} · Owner: {owner?.name ?? "Bank"}
              </p>
              {hasMonopoly && (
                <p className="mt-1 text-xs font-semibold text-emerald-600">
                  Monopoly — double base rent, can build
                </p>
              )}
              {square.houses > 0 && (
                <p className="text-xs">
                  {square.houses >= 5 ? "Hotel" : `${square.houses} house(s)`}
                </p>
              )}
            </div>
            {rent && square.type === "property" && (
              <div className="text-xs opacity-80">
                <p>Rent: ${rent.base} · 1h ${rent.oneHouse}</p>
                <p>2h ${rent.twoHouses} · 3h ${rent.threeHouses}</p>
                <p>4h ${rent.fourHouses} · Hotel ${rent.hotel}</p>
              </div>
            )}
            <div className="mt-auto flex gap-2">
              {canBuild && (
                <button
                  type="button"
                  onClick={() => buildHouse(square.id)}
                  className="flex-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-500"
                >
                  Build (${square.houseCost})
                </button>
              )}
              <button
                type="button"
                onClick={() => setPropertyCardFlipped(true)}
                className="flex-1 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                Flip
              </button>
            </div>
          </GlassPanel>

          <GlassPanel className="backface-hidden absolute inset-0 flex flex-col justify-between p-5 [transform:rotateY(180deg)]">
            <div className="text-sm">
              <p className="font-semibold">Square #{square.boardIndex}</p>
              <p className="mt-2 opacity-80">House cost: ${square.houseCost ?? "N/A"}</p>
              {square.type === "railroad" && (
                <p className="mt-1">Rent scales with railroads owned</p>
              )}
              {square.type === "utility" && (
                <p className="mt-1">Rent: 4× or 10× dice roll</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedPropertyId(null)}
              className="rounded-lg border px-3 py-2 text-sm font-semibold hover:opacity-80"
              style={{ borderColor: "var(--glass-border)" }}
            >
              Close
            </button>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
