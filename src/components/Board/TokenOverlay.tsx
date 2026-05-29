import { useEffect, useRef, useState } from "react";
import { POSITION_TO_CELL } from "../../data/boardLayout";
import { useGameStore } from "../../store/gameStore";

const TOKEN_ICONS: Record<string, string> = {
  p1: "🎩",
  p2: "🚗",
};

const TOKEN_GRADIENT: Record<string, string> = {
  p1: "linear-gradient(135deg, #2563eb, #1d4ed8)",
  p2: "linear-gradient(135deg, #dc2626, #b91c1c)",
};

const TOKEN_LABEL_BG: Record<string, string> = {
  p1: "#1d4ed8",
  p2: "#b91c1c",
};

const GRID_SIZE = 11;
/** Must match gap-px on the grid — 1px gap between each cell */
const GAP_PX = 1;
/** Overlay token diameter */
const TOKEN_SIZE = 32;

interface TokenOverlayProps {
  boardRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Absolute overlay that renders all player tokens at a fixed TOKEN_SIZE (32px),
 * always visible regardless of tile size.
 *
 * Positions are calculated from POSITION_TO_CELL and live cell measurements.
 * Accounts for the 1px gap between grid cells.
 * Tokens smoothly slide between squares via CSS position transition.
 * The current player's token gets a pulsing halo ring + name label.
 */
export function TokenOverlay({ boardRef }: TokenOverlayProps) {
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = boardRef.current;
      if (!el) return;
      // offsetWidth/Height give CSS pixel size without fractional scaling
      setDims({ w: el.offsetWidth, h: el.offsetHeight });
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (boardRef.current) ro.observe(boardRef.current);
    return () => ro.disconnect();
  }, [boardRef]);

  if (!dims || dims.w === 0) return null;

  // Cell size accounting for 10 gaps of GAP_PX each in an 11-column grid
  const totalGapW = GAP_PX * (GRID_SIZE - 1);
  const totalGapH = GAP_PX * (GRID_SIZE - 1);
  const cellW = (dims.w - totalGapW) / GRID_SIZE;
  const cellH = (dims.h - totalGapH) / GRID_SIZE;

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 30 }}
      aria-hidden="true"
    >
      {players.map((player, idx) => {
        const cell = POSITION_TO_CELL[player.position];
        if (!cell) return null;

        const isCurrentPlayer = idx === currentPlayerIndex;

        // Handle same-square stacking
        const siblings = players.filter((p) => p.position === player.position);
        const myIndex = siblings.findIndex((p) => p.id === player.id);
        const total = siblings.length;
        const offsetX = total > 1 ? (myIndex - (total - 1) / 2) * (TOKEN_SIZE + 4) : 0;

        // Cell top-left accounts for gaps: each column after 0 adds an extra GAP_PX
        const cellLeft = cell.col * (cellW + GAP_PX);
        const cellTop = cell.row * (cellH + GAP_PX);
        const centerX = cellLeft + cellW / 2;
        const centerY = cellTop + cellH / 2;

        const left = centerX + offsetX - TOKEN_SIZE / 2;
        const top = centerY - TOKEN_SIZE / 2;

        return (
          <OverlayToken
            key={player.id}
            playerId={player.id}
            playerName={player.name}
            position={player.position}
            left={left}
            top={top}
            isCurrentPlayer={isCurrentPlayer}
          />
        );
      })}
    </div>
  );
}

interface OverlayTokenProps {
  playerId: string;
  playerName: string;
  position: number;
  left: number;
  top: number;
  isCurrentPlayer: boolean;
}

function OverlayToken({
  playerId,
  playerName,
  position,
  left,
  top,
  isCurrentPlayer,
}: OverlayTokenProps) {
  const [bounceKey, setBounceKey] = useState(0);
  const prevPos = useRef(position);

  useEffect(() => {
    if (position !== prevPos.current) {
      setBounceKey((k) => k + 1);
      prevPos.current = position;
    }
  }, [position]);

  const icon = TOKEN_ICONS[playerId] ?? "🎲";
  const gradient = TOKEN_GRADIENT[playerId] ?? "linear-gradient(135deg,#6b7280,#374151)";
  const labelBg = TOKEN_LABEL_BG[playerId] ?? "#374151";
  const haloClass =
    playerId === "p1" ? "animate-token-halo-p1" : "animate-token-halo-p2";

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: TOKEN_SIZE,
        // Give extra height for the label tag below
        height: TOKEN_SIZE + 14,
        transition:
          "left 0.28s cubic-bezier(0.34,1.56,0.64,1), top 0.28s cubic-bezier(0.34,1.56,0.64,1)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      {/* Ground shadow */}
      <div
        style={{
          width: TOKEN_SIZE * 0.7,
          height: 4,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.45)",
          filter: "blur(3px)",
          marginTop: TOKEN_SIZE - 2,
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      />

      {/* Halo ring — only for current player, pulsing */}
      {isCurrentPlayer && (
        <div
          className={haloClass}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: TOKEN_SIZE,
            height: TOKEN_SIZE,
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Token body */}
      <div
        key={bounceKey}
        style={{
          width: TOKEN_SIZE,
          height: TOKEN_SIZE,
          borderRadius: "50%",
          background: gradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: TOKEN_SIZE * 0.50,
          lineHeight: 1,
          userSelect: "none",
          flexShrink: 0,
          animation: "token-land 0.42s cubic-bezier(0.34,1.56,0.64,1) both",
          border: isCurrentPlayer ? "2px solid rgba(255,255,255,0.9)" : "1.5px solid rgba(255,255,255,0.6)",
        }}
      >
        {icon}
      </div>

      {/* Name label — always visible */}
      <div
        style={{
          background: labelBg,
          color: "#fff",
          fontSize: 8,
          fontWeight: 800,
          lineHeight: 1,
          padding: "2px 4px",
          borderRadius: 3,
          whiteSpace: "nowrap",
          boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          opacity: isCurrentPlayer ? 1 : 0.75,
        }}
      >
        {playerName}
      </div>
    </div>
  );
}
