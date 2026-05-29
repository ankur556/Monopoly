import { COLOR_BAND, SPECIAL_SQUARE_STYLE } from "../../data/squareStyles";
import { useGameStore } from "../../store/gameStore";
import type { BoardSquare as BoardSquareType, Player } from "../../types/game";
import { HouseIndicators } from "./HouseIndicators";
import { PlayerTokens } from "./PlayerTokens";

const OWNER_RING: Record<string, string> = {
  p1: "ring-2 ring-blue-400/80",
  p2: "ring-2 ring-red-400/80",
};

interface BoardSquareProps {
  square: BoardSquareType;
  players: Player[];
  isCorner: boolean;
  isHighlighted?: boolean;
}

export function BoardSquare({
  square,
  players,
  isCorner,
  isHighlighted = false,
}: BoardSquareProps) {
  const setSelectedPropertyId = useGameStore((s) => s.setSelectedPropertyId);
  const isPurchasable =
    square.type === "property" ||
    square.type === "railroad" ||
    square.type === "utility";

  const colorBand =
    square.colorGroup && COLOR_BAND[square.colorGroup]
      ? COLOR_BAND[square.colorGroup]
      : null;

  const special =
    square.type !== "property" &&
    square.type !== "railroad" &&
    square.type !== "utility"
      ? SPECIAL_SQUARE_STYLE[square.type]
      : null;

  const ownerRing = square.ownerId ? OWNER_RING[square.ownerId] : "";

  return (
    <button
      type="button"
      disabled={!isPurchasable}
      onClick={() => isPurchasable && setSelectedPropertyId(square.id)}
      className={`group relative flex h-full min-h-10 min-w-0 flex-col overflow-hidden border border-black/20 bg-[#f8f5f0] text-left shadow-sm transition hover:z-10 hover:shadow-md disabled:cursor-default dark:bg-zinc-100 sm:min-h-12 ${ownerRing} ${isCorner ? "sm:min-h-14" : ""} ${isHighlighted ? "animate-square-pulse z-10 ring-2 ring-amber-400 ring-offset-1" : ""}`}
    >
      {colorBand && (
        <div className={`h-2 w-full shrink-0 sm:h-2.5 ${colorBand}`} />
      )}

      {special && !colorBand && (
        <div
          className={`flex flex-1 flex-col items-center justify-center px-0.5 ${special.bg} ${special.text}`}
        >
          <span
            className={`font-bold leading-tight ${isCorner ? "text-[9px] sm:text-xs" : "text-[7px] sm:text-[8px]"}`}
          >
            {square.name}
          </span>
          {square.type === "tax" && square.taxAmount && (
            <span className="text-[6px] opacity-90 sm:text-[7px]">
              Pay ${square.taxAmount}
            </span>
          )}
        </div>
      )}

      {!special && (
        <div className="flex flex-1 flex-col justify-between p-0.5">
          <span
            className={`truncate font-semibold leading-tight text-zinc-900 ${isCorner ? "text-[8px] sm:text-[9px]" : "text-[6px] sm:text-[7px]"}`}
            style={{
              writingMode: isCorner ? "horizontal-tb" : "vertical-rl",
              textOrientation: "mixed",
            }}
          >
            {square.name}
          </span>
          {square.price !== undefined && (
            <span className="text-[6px] font-medium text-zinc-600 sm:text-[7px]">
              ${square.price}
            </span>
          )}
        </div>
      )}

      <HouseIndicators houses={square.houses} />
      <PlayerTokens players={players} position={square.boardIndex} />
    </button>
  );
}
