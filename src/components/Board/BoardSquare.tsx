import { COLOR_BAND, SPECIAL_SQUARE_STYLE } from "../../data/squareStyles";
import { useGameStore } from "../../store/gameStore";
import type { BoardSquare as BoardSquareType, Player } from "../../types/game";
import { HouseIndicators } from "./HouseIndicators";

const OWNER_RING: Record<string, string> = {
  p1: "ring-2 ring-blue-400/80",
  p2: "ring-2 ring-red-400/80",
};

/** Tile glow animation class when a player is standing on this square */
const PLAYER_TILE_GLOW: Record<string, string> = {
  p1: "animate-player-tile-glow-p1",
  p2: "animate-player-tile-glow-p2",
};

/** Which players are currently on this square */
function getPlayersOnSquare(players: Player[], boardIndex: number): Player[] {
  return players.filter((p) => p.position === boardIndex);
}

/** Small inline icon indicating property type */
function TileTypeIcon({ square }: { square: BoardSquareType }) {
  if (square.type === "railroad") {
    return <span className="text-[8px] leading-none sm:text-[10px]">🚂</span>;
  }
  if (square.type === "utility") {
    const isElectric = square.id === "sq12";
    return (
      <span className="text-[8px] leading-none sm:text-[10px]">
        {isElectric ? "⚡" : "🚰"}
      </span>
    );
  }
  return null;
}

/** Decorative icons for special squares */
function SpecialIcon({ type }: { type: BoardSquareType["type"] }) {
  const icons: Partial<Record<BoardSquareType["type"], string>> = {
    go: "▶",
    chance: "?",
    chest: "📦",
    tax: "💰",
    jail: "🔒",
    "free-parking": "🅿",
    "go-to-jail": "👮",
  };
  return icons[type] ? (
    <span className="text-[9px] sm:text-xs">{icons[type]}</span>
  ) : null;
}

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
  const playersHere = getPlayersOnSquare(players, square.boardIndex);
  const hasPlayers = playersHere.length > 0;

  // Pick the first player's glow (p1 wins if both share the square)
  const tileGlowClass = hasPlayers
    ? (PLAYER_TILE_GLOW[playersHere[0].id] ?? "")
    : "";

  return (
    <button
      type="button"
      disabled={!isPurchasable}
      onClick={() => isPurchasable && setSelectedPropertyId(square.id)}
      className={`
        group relative flex h-full min-h-10 min-w-0 flex-col overflow-hidden
        border border-black/20 text-left shadow-sm transition
        hover:z-10 hover:shadow-md disabled:cursor-default
        sm:min-h-12
        ${isCorner ? "sm:min-h-14" : ""}
        ${ownerRing}
        ${isHighlighted ? "animate-square-pulse z-10 ring-2 ring-amber-400 ring-offset-1" : ""}
        ${tileGlowClass}
      `}
      style={{
        backgroundColor: hasPlayers
          ? playersHere[0].id === "p1"
            ? "rgba(219,234,254,0.95)"   // blue-100 tint
            : "rgba(254,226,226,0.95)"   // red-100 tint
          : "#f8f5f0",
      }}
    >
      {/* Color band for properties */}
      {colorBand && (
        <div className={`h-2 w-full shrink-0 sm:h-3 ${colorBand}`} />
      )}

      {/* Special squares */}
      {special && !colorBand && (
        <div
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 px-0.5 ${special.bg} ${special.text}`}
        >
          <SpecialIcon type={square.type} />
          <span
            className={`font-bold leading-tight ${isCorner ? "text-[9px] sm:text-xs" : "text-[7px] sm:text-[8px]"}`}
          >
            {square.name}
          </span>
          {square.type === "tax" && square.taxAmount && (
            <span className="text-[6px] opacity-90 sm:text-[7px]">
              ${square.taxAmount}
            </span>
          )}
        </div>
      )}

      {/* Property / railroad / utility */}
      {!special && (
        <div className="flex flex-1 flex-col items-center justify-between p-0.5">
          <TileTypeIcon square={square} />
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

      {/* Building indicators */}
      <HouseIndicators houses={square.houses} />

      {/* Player presence indicator dots — always visible even on tiny tiles */}
      {hasPlayers && (
        <div className="absolute right-0.5 top-0.5 flex gap-px">
          {playersHere.map((p) => (
            <span
              key={p.id}
              className={`block h-1.5 w-1.5 rounded-full ${p.id === "p1" ? "bg-blue-500" : "bg-red-500"}`}
              title={p.name}
            />
          ))}
        </div>
      )}
    </button>
  );
}
