import { useEffect } from "react";
import { COLOR_GROUP_MEMBERS } from "../../data/boardDefinitions";
import { canBuildOn } from "../../lib/building";
import { ownsColorSet } from "../../lib/rent";
import { useGameStore } from "../../store/gameStore";
import { TitleDeedCard } from "./TitleDeedCard";

/**
 * Modal that shows the physical Title Deed Card when a player clicks a property.
 * Replaces the old 3D card flip with a clean slide-up modal + deed card.
 */
export function PropertyCardModal() {
  const selectedPropertyId = useGameStore((s) => s.selectedPropertyId);
  const squares = useGameStore((s) => s.squares);
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const setSelectedPropertyId = useGameStore((s) => s.setSelectedPropertyId);
  const buildHouse = useGameStore((s) => s.buildHouse);
  const isMoving = useGameStore((s) => s.isMoving);
  const isRolling = useGameStore((s) => s.isRolling);

  const lastRoll = useGameStore((s) => s.lastRoll);

  const square = squares.find((s) => s.id === selectedPropertyId);
  const owner = square?.ownerId
    ? players.find((p) => p.id === square.ownerId)
    : null;
  const currentPlayer = players[currentPlayerIndex];

  const canBuild =
    square &&
    !isMoving &&
    !isRolling &&
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

  if (!square) return null;
  if (
    square.type !== "property" &&
    square.type !== "railroad" &&
    square.type !== "utility"
  ) {
    return null;
  }

  const notCurrentOwner = square.ownerId && square.ownerId !== currentPlayer.id;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => setSelectedPropertyId(null)}
      role="presentation"
    >
      <div
        className="flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Property card: ${square.name}`}
      >
        {/* Physical deed card */}
        <TitleDeedCard
          square={square}
          ownerName={owner?.name}
          squares={squares}
          lastDiceRoll={lastRoll ?? 7}
        />

        {/* Monopoly badge */}
        {hasMonopoly && (
          <div className="flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-900 shadow-lg">
            ⭐ Color Monopoly — Double Base Rent
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {canBuild && (
            <button
              id={`build-house-${square.id}`}
              type="button"
              onClick={() => {
                buildHouse(square.id);
                setSelectedPropertyId(null);
              }}
              className="rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 px-5 py-2.5 text-sm font-black uppercase tracking-wide text-white shadow-xl transition hover:scale-105 hover:from-amber-400 hover:to-amber-600 active:scale-95"
            >
              🏠 Build House — ${square.houseCost}
            </button>
          )}

          {notCurrentOwner && (
            <div className="rounded-xl bg-red-900/80 px-4 py-2.5 text-sm font-semibold text-red-200">
              Owned by {owner?.name}
            </div>
          )}

          <button
            id={`close-deed-card-${square.id}`}
            type="button"
            onClick={() => setSelectedPropertyId(null)}
            className="rounded-xl bg-white/15 px-5 py-2.5 text-sm font-semibold text-white shadow backdrop-blur-sm transition hover:bg-white/25"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
