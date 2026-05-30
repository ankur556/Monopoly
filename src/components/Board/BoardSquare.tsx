import { useGameStore } from "../../store/gameStore";
import type { BoardSquare as BoardSquareType, Player } from "../../types/game";
import { HouseIndicators } from "./HouseIndicators";

// ── 6-player colour palette ────────────────────────────────────────────────
const PLAYER_DOT_BG: Record<string, string> = {
  p1: "#3b82f6",
  p2: "#ef4444",
  p3: "#10b981",
  p4: "#f59e0b",
  p5: "#8b5cf6",
  p6: "#ec4899",
};

const PLAYER_TILE_BG: Record<string, string> = {
  p1: "rgba(219,234,254,0.92)",
  p2: "rgba(254,226,226,0.92)",
  p3: "rgba(209,250,229,0.92)",
  p4: "rgba(254,243,199,0.92)",
  p5: "rgba(237,233,254,0.92)",
  p6: "rgba(252,231,243,0.92)",
};

const PLAYER_OWNER_RING: Record<string, string> = {
  p1: "ring-2 ring-blue-400/80",
  p2: "ring-2 ring-red-400/80",
  p3: "ring-2 ring-emerald-400/80",
  p4: "ring-2 ring-amber-400/80",
  p5: "ring-2 ring-violet-400/80",
  p6: "ring-2 ring-pink-400/80",
};

const PLAYER_TILE_GLOW: Record<string, string> = {
  p1: "animate-player-tile-glow-p1",
  p2: "animate-player-tile-glow-p2",
  p3: "animate-player-tile-glow-p3",
  p4: "animate-player-tile-glow-p4",
  p5: "animate-player-tile-glow-p5",
  p6: "animate-player-tile-glow-p6",
};

// ── Top band colour for every square type ────────────────────────────────
// Properties use their colorGroup colour; specials use a type-specific accent.
const COLOR_BAND_HEX: Record<string, string> = {
  // color groups
  brown: "#8B4513",
  "light-blue": "#87CEEB",
  pink: "#FF69B4",
  orange: "#FF8C00",
  red: "#DC143C",
  yellow: "#FFD700",
  green: "#228B22",
  "dark-blue": "#00008B",
  railroad: "#2F2F2F",
  utility: "#9ca3af",
  // special types
  go: "#dc2626",
  chance: "#f59e0b",
  chest: "#3b82f6",
  tax: "#71717a",
  jail: "#f59e0b",
  "free-parking": "#10b981",
  "go-to-jail": "#27272a",
};

// ── Square label / icon ───────────────────────────────────────────────────
const SQUARE_ICON: Partial<Record<string, string>> = {
  go: "▶",
  chance: "?",
  chest: "☁",
  tax: "💰",
  jail: "🔒",
  "free-parking": "🅿",
  "go-to-jail": "👮",
  railroad: "🚂",
};

function getUtilityIcon(id: string) {
  return id === "sq12" ? "⚡" : "🚰";
}

function getPlayersOnSquare(players: Player[], boardIndex: number): Player[] {
  return players.filter((p) => p.position === boardIndex);
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

  const playersHere = getPlayersOnSquare(players, square.boardIndex);
  const hasPlayers = playersHere.length > 0;
  const primaryPlayer = playersHere[0];

  const tileGlowClass = primaryPlayer ? (PLAYER_TILE_GLOW[primaryPlayer.id] ?? "") : "";
  const ownerRing = square.ownerId ? (PLAYER_OWNER_RING[square.ownerId] ?? "") : "";

  // Background: player tint when present, else adaptive CSS variable
  const tileBg = primaryPlayer
    ? (PLAYER_TILE_BG[primaryPlayer.id] ?? "var(--tile-bg)")
    : "var(--tile-bg)";

  // ── Top band colour ────────────────────────────────────────────────────
  const bandKey = square.colorGroup ?? square.type;
  const bandHex = COLOR_BAND_HEX[bandKey] ?? "#a1a1aa";

  // ── Icon / label ──────────────────────────────────────────────────────
  const icon =
    square.type === "utility"
      ? getUtilityIcon(square.id)
      : (SQUARE_ICON[square.type] ?? null);

  // Corner tiles render differently (horizontal layout, larger content)
  if (isCorner) {
    return (
      <button
        type="button"
        disabled={!isPurchasable}
        onClick={() => isPurchasable && setSelectedPropertyId(square.id)}
        className={`
          group relative flex h-full w-full flex-col overflow-hidden
          border border-black/20 text-left shadow-sm transition
          hover:z-10 hover:shadow-md disabled:cursor-default
          ${ownerRing}
          ${isHighlighted ? "animate-square-pulse z-10 ring-2 ring-amber-400 ring-offset-1" : ""}
          ${tileGlowClass}
        `}
        style={{ backgroundColor: tileBg }}
      >
        {/* Colour accent strip */}
        <div style={{ height: 5, backgroundColor: bandHex, width: "100%", flexShrink: 0 }} />

        {/* Corner body — centred */}
        <div className="flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-0.5" style={{ color: "var(--tile-text)" }}>
          {icon && <span className="text-sm leading-none">{icon}</span>}
          <span className="text-center text-[7px] font-black leading-tight sm:text-[8px]" style={{ color: "var(--tile-text)" }}>
            {square.name}
          </span>
          {square.type === "tax" && square.taxAmount && (
            <span className="text-[6px] font-medium" style={{ color: "var(--tile-text)", opacity: 0.75 }}>${square.taxAmount}</span>
          )}
        </div>

        {/* Player dots */}
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

  // ── Edge tiles (properties, railroads, utilities, chance, chest, tax…) ──
  // ALL share the exact same structure so they look uniform:
  //   [colour band] → [icon small] → [name vertical] → [price small]
  return (
    <button
      type="button"
      disabled={!isPurchasable}
      onClick={() => isPurchasable && setSelectedPropertyId(square.id)}
      className={`
        group relative flex h-full w-full flex-col items-center overflow-hidden
        border border-black/20 text-left shadow-sm transition
        hover:z-10 hover:shadow-md disabled:cursor-default
        ${ownerRing}
        ${isHighlighted ? "animate-square-pulse z-10 ring-2 ring-amber-400 ring-offset-1" : ""}
        ${tileGlowClass}
      `}
      style={{ backgroundColor: tileBg }}
    >
      {/* ── Top colour band — always present, sized to ~18% of tile height ── */}
      <div
        className="w-full shrink-0"
        style={{
          height: "18%",
          minHeight: 6,
          maxHeight: 14,
          backgroundColor: bandHex,
          boxShadow: `0 1px 4px ${bandHex}99`,
        }}
      />

      {/* ── Tile body — same for ALL edge tiles ─────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-between py-0.5">
        {/* Small icon at top of body */}
        {icon && (
          <span className="text-[8px] leading-none" style={{ lineHeight: 1 }}>
            {icon}
          </span>
        )}

        {/* Name — always vertical for edge tiles */}
        <span
          className="flex-1 text-center text-[6px] font-bold leading-tight sm:text-[7px]"
          style={{
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            overflow: "hidden",
            maxHeight: "100%",
            color: "var(--tile-text)",
          }}
        >
          {square.name}
        </span>

        {/* Price or tax amount at bottom */}
        {square.price !== undefined && (
          <span className="text-[5px] font-semibold sm:text-[6px]" style={{ color: "var(--tile-text)", opacity: 0.7 }}>
            ${square.price}
          </span>
        )}
        {square.type === "tax" && square.taxAmount && !square.price && (
          <span className="text-[5px] font-semibold sm:text-[6px]" style={{ color: "var(--tile-text)", opacity: 0.7 }}>
            ${square.taxAmount}
          </span>
        )}
      </div>

      {/* Building indicators */}
      <HouseIndicators houses={square.houses} />

      {/* Owner strip at bottom */}
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

      {/* Player presence dots — top-right corner */}
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
