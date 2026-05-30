import { SPECIAL_SQUARE_STYLE } from "../../data/squareStyles";
import { useGameStore } from "../../store/gameStore";
import type { BoardSquare as BoardSquareType, Player } from "../../types/game";
import { HouseIndicators } from "./HouseIndicators";

// ── 6-player colour palette (matches TokenOverlay & StartMenu) ─────────────
const PLAYER_DOT_BG: Record<string, string> = {
  p1: "#3b82f6", // blue-500
  p2: "#ef4444", // red-500
  p3: "#10b981", // emerald-500
  p4: "#f59e0b", // amber-500
  p5: "#8b5cf6", // violet-500
  p6: "#ec4899", // pink-500
};

const PLAYER_TILE_BG: Record<string, string> = {
  p1: "rgba(219,234,254,0.95)", // blue-100
  p2: "rgba(254,226,226,0.95)", // red-100
  p3: "rgba(209,250,229,0.95)", // emerald-100
  p4: "rgba(254,243,199,0.95)", // amber-100
  p5: "rgba(237,233,254,0.95)", // violet-100
  p6: "rgba(252,231,243,0.95)", // pink-100
};

const PLAYER_OWNER_RING: Record<string, string> = {
  p1: "ring-2 ring-blue-400/80",
  p2: "ring-2 ring-red-400/80",
  p3: "ring-2 ring-emerald-400/80",
  p4: "ring-2 ring-amber-400/80",
  p5: "ring-2 ring-violet-400/80",
  p6: "ring-2 ring-pink-400/80",
};

// animate-player-tile-glow-p1 … p6 are defined in index.css
const PLAYER_TILE_GLOW: Record<string, string> = {
  p1: "animate-player-tile-glow-p1",
  p2: "animate-player-tile-glow-p2",
  p3: "animate-player-tile-glow-p3",
  p4: "animate-player-tile-glow-p4",
  p5: "animate-player-tile-glow-p5",
  p6: "animate-player-tile-glow-p6",
};

// Hex colours for property color bands — used as inline styles so they're always reliable
const COLOR_BAND_HEX: Record<string, string> = {
  brown: "#8B4513",
  "light-blue": "#87CEEB",
  pink: "#FF69B4",
  orange: "#FF8C00",
  red: "#DC143C",
  yellow: "#FFD700",
  green: "#228B22",
  "dark-blue": "#00008B",
  railroad: "#2F2F2F",
  utility: "#C0C0C0",
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

  const special =
    square.type !== "property" &&
    square.type !== "railroad" &&
    square.type !== "utility"
      ? SPECIAL_SQUARE_STYLE[square.type]
      : null;

  const colorBandHex = square.colorGroup
    ? (COLOR_BAND_HEX[square.colorGroup] ?? null)
    : null;

  // Owner ring & tile bg
  const ownerRing = square.ownerId ? (PLAYER_OWNER_RING[square.ownerId] ?? "") : "";
  const playersHere = getPlayersOnSquare(players, square.boardIndex);
  const hasPlayers = playersHere.length > 0;

  // Use the first player here for glow/bg (lower index = higher priority)
  const primaryPlayer = playersHere[0];
  const tileGlowClass = primaryPlayer
    ? (PLAYER_TILE_GLOW[primaryPlayer.id] ?? "")
    : "";
  const tileBg = primaryPlayer
    ? (PLAYER_TILE_BG[primaryPlayer.id] ?? "#f8f5f0")
    : "#f8f5f0";

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
      style={{ backgroundColor: tileBg }}
    >
      {/* ── Color band for properties ──────────────────────────────────────── */}
      {colorBandHex && (
        <div
          className="w-full shrink-0"
          style={{
            height: "14%",
            minHeight: 5,
            maxHeight: 12,
            backgroundColor: colorBandHex,
            boxShadow: `0 1px 3px ${colorBandHex}88`,
          }}
        />
      )}

      {/* Special squares (GO, Chance, etc.) */}
      {special && !colorBandHex && (
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

      {/* Property / railroad / utility body */}
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

      {/* Owner color strip at bottom of tile */}
      {square.ownerId && (
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            height: 3,
            backgroundColor: PLAYER_DOT_BG[square.ownerId] ?? "#6b7280",
            opacity: 0.85,
          }}
        />
      )}

      {/* Player presence dots — top-right, always visible */}
      {hasPlayers && (
        <div className="absolute right-0.5 top-0.5 flex flex-col gap-px">
          {playersHere.map((p) => (
            <span
              key={p.id}
              className="block h-1.5 w-1.5 rounded-full shadow-sm"
              style={{ backgroundColor: PLAYER_DOT_BG[p.id] ?? "#6b7280" }}
              title={p.name}
            />
          ))}
        </div>
      )}
    </button>
  );
}
