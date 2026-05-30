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

// ── Property colour bands (thin stripe at top) ───────────────────────────
const PROPERTY_BAND_HEX: Record<string, string> = {
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
};

// ── Special square styling (full gradient + icon + label) ─────────────────
// Each entry: gradient string, text colour (light/dark), emoji icon
const SPECIAL_CONFIG: Record<
  string,
  { grad: string; textColor: string; icon: string; label?: string }
> = {
  go: {
    grad: "linear-gradient(135deg,#ef4444 0%,#b91c1c 100%)",
    textColor: "#ffffff",
    icon: "▶",
    label: "GO",
  },
  chance: {
    grad: "linear-gradient(135deg,#f59e0b 0%,#d97706 100%)",
    textColor: "#1c1917",
    icon: "?",
    label: "CHANCE",
  },
  chest: {
    grad: "linear-gradient(135deg,#38bdf8 0%,#2563eb 100%)",
    textColor: "#ffffff",
    icon: "☁",
    label: "CHEST",
  },
  tax: {
    grad: "linear-gradient(135deg,#6b7280 0%,#374151 100%)",
    textColor: "#f9fafb",
    icon: "💰",
  },
  jail: {
    grad: "linear-gradient(135deg,#fde68a 0%,#f59e0b 100%)",
    textColor: "#1c1917",
    icon: "🔒",
    label: "JAIL",
  },
  "free-parking": {
    grad: "linear-gradient(135deg,#34d399 0%,#059669 100%)",
    textColor: "#ffffff",
    icon: "🅿",
    label: "FREE",
  },
  "go-to-jail": {
    grad: "linear-gradient(135deg,#374151 0%,#111827 100%)",
    textColor: "#f9fafb",
    icon: "👮",
    label: "GO TO JAIL",
  },
};

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

  const isSpecial = !isPurchasable; // chance, chest, tax, go, jail, free-parking, go-to-jail
  const specialCfg = isSpecial ? (SPECIAL_CONFIG[square.type] ?? null) : null;

  const playersHere = getPlayersOnSquare(players, square.boardIndex);
  const hasPlayers = playersHere.length > 0;
  const primaryPlayer = playersHere[0];

  const tileGlowClass = primaryPlayer ? (PLAYER_TILE_GLOW[primaryPlayer.id] ?? "") : "";
  const ownerRing = square.ownerId ? (PLAYER_OWNER_RING[square.ownerId] ?? "") : "";

  // Background for property tiles (with optional player tint)
  const propertyBg = primaryPlayer
    ? (PLAYER_TILE_BG[primaryPlayer.id] ?? "var(--tile-bg)")
    : "var(--tile-bg)";

  // Property top-band colour
  const bandHex = square.colorGroup
    ? (PROPERTY_BAND_HEX[square.colorGroup] ?? "#a1a1aa")
    : PROPERTY_BAND_HEX[square.type] ?? "#a1a1aa";

  // Railroad / utility small icon
  const propertyIcon =
    square.type === "railroad"
      ? "🚂"
      : square.type === "utility"
        ? square.id === "sq12"
          ? "⚡"
          : "🚰"
        : null;

  // ── Shared button wrapper classes ────────────────────────────────────────
  const baseClass = `
    group relative flex h-full w-full overflow-hidden
    border border-black/25 text-left shadow-sm transition
    hover:z-10 hover:shadow-md disabled:cursor-default
    ${ownerRing}
    ${isHighlighted ? "animate-square-pulse z-10 ring-2 ring-amber-400 ring-offset-1" : ""}
    ${tileGlowClass}
  `;

  // ════════════════════════════════════════════════════════════
  // SPECIAL SQUARES — full gradient, big icon, label
  // ════════════════════════════════════════════════════════════
  if (isSpecial && specialCfg) {
    // When a player is on this square, overlay a tinted veil instead of replacing the gradient
    const overlayStyle = primaryPlayer
      ? { backgroundColor: PLAYER_TILE_BG[primaryPlayer.id] ?? "transparent" }
      : undefined;

    return (
      <button
        type="button"
        disabled
        className={`${baseClass} flex-col items-center justify-center`}
        style={{ background: specialCfg.grad }}
      >
        {/* Semi-transparent player tint overlay */}
        {primaryPlayer && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ ...overlayStyle, opacity: 0.35 }}
          />
        )}

        {/* Content */}
        <div
          className="relative flex h-full w-full flex-col items-center justify-center gap-px px-0.5 py-0.5"
          style={{ color: specialCfg.textColor }}
        >
          {/* Big icon */}
          <span
            className="leading-none select-none"
            style={{
              fontSize: isCorner ? "1.25rem" : "0.875rem",
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))",
            }}
          >
            {specialCfg.icon}
          </span>

          {/* Label */}
          <span
            className="text-center font-black leading-tight tracking-tight select-none"
            style={{
              fontSize: isCorner ? "0.5rem" : "0.4rem",
              textShadow: "0 1px 2px rgba(0,0,0,0.5)",
              writingMode: isCorner ? "horizontal-tb" : "vertical-rl",
              textOrientation: "mixed",
              maxHeight: isCorner ? undefined : "100%",
              overflow: "hidden",
            }}
          >
            {specialCfg.label ?? square.name}
          </span>

          {/* Tax amount */}
          {square.type === "tax" && square.taxAmount && (
            <span
              className="text-center font-semibold leading-none"
              style={{
                fontSize: "0.35rem",
                opacity: 0.85,
                textShadow: "0 1px 1px rgba(0,0,0,0.4)",
              }}
            >
              ${square.taxAmount}
            </span>
          )}
        </div>

        {/* Player dots */}
        {hasPlayers && (
          <div className="absolute right-0.5 top-0.5 flex flex-col gap-px z-10">
            {playersHere.map((p) => (
              <span
                key={p.id}
                className="block h-1.5 w-1.5 rounded-full shadow-sm ring-1 ring-white/50"
                style={{ backgroundColor: PLAYER_DOT_BG[p.id] ?? "#6b7280" }}
                title={p.name}
              />
            ))}
          </div>
        )}
      </button>
    );
  }

  // ════════════════════════════════════════════════════════════
  // PROPERTY / RAILROAD / UTILITY — band + white bg + vertical text
  // ════════════════════════════════════════════════════════════
  return (
    <button
      type="button"
      disabled={!isPurchasable}
      onClick={() => isPurchasable && setSelectedPropertyId(square.id)}
      className={`${baseClass} flex-col items-center`}
      style={{ backgroundColor: propertyBg }}
    >
      {/* Colour band */}
      <div
        className="w-full shrink-0"
        style={{
          height: "18%",
          minHeight: 6,
          maxHeight: 14,
          backgroundColor: bandHex,
          boxShadow: `0 1px 4px ${bandHex}88`,
        }}
      />

      {/* Body */}
      <div className="flex flex-1 flex-col items-center justify-between py-0.5">
        {propertyIcon && (
          <span className="text-[8px] leading-none">{propertyIcon}</span>
        )}

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

        {square.price !== undefined && (
          <span
            className="text-[5px] font-semibold sm:text-[6px]"
            style={{ color: "var(--tile-text)", opacity: 0.7 }}
          >
            ${square.price}
          </span>
        )}
      </div>

      {/* Building indicators */}
      <HouseIndicators houses={square.houses} />

      {/* Owner strip */}
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
