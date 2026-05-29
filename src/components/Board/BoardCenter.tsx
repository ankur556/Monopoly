import { useGameStore } from "../../store/gameStore";
import { ActionTicker } from "./ActionTicker";
import { BoardAnnouncement } from "./BoardAnnouncement";
import { CardRevealEffect } from "./CardRevealEffect";

const PLAYER_BADGE_COLORS: Record<string, { ring: string; dot: string }> = {
  p1: { ring: "ring-blue-400/70", dot: "bg-blue-400" },
  p2: { ring: "ring-red-400/70", dot: "bg-red-400" },
};

export function BoardCenter() {
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const isMoving = useGameStore((s) => s.isMoving);
  const isRolling = useGameStore((s) => s.isRolling);
  const currentPlayer = players[currentPlayerIndex];
  const badge = PLAYER_BADGE_COLORS[currentPlayer.id] ?? { ring: "ring-white/30", dot: "bg-white" };

  return (
    <div
      className="relative flex min-h-0 flex-col overflow-hidden rounded-md"
      style={{
        gridColumn: "2 / 11",
        gridRow: "2 / 11",
        backgroundColor: "var(--board-felt)",
      }}
    >
      {/* Radial highlight */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06)_0%,transparent_70%)]" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col p-2 sm:p-3">
        {/* Title + current player badge */}
        <div className="mb-2 shrink-0 flex items-center justify-between gap-2">
          <span className="text-sm font-black tracking-[0.25em] text-emerald-100/90 sm:text-base">
            MONOPOLY
          </span>

          {/* Persistent current player turn badge */}
          <div
            className={`flex items-center gap-1.5 rounded-full ring-1 px-2 py-0.5 backdrop-blur-sm bg-black/30 animate-turn-badge-pulse ${badge.ring}`}
          >
            <span className={`h-2 w-2 rounded-full ${badge.dot} ${isMoving || isRolling ? "animate-bounce" : ""}`} />
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/90 sm:text-[10px]">
              {currentPlayer.name}
            </span>
          </div>
        </div>

        {/* Action log ticker */}
        <div className="min-h-0 flex-1">
          <ActionTicker />
        </div>
      </div>

      <BoardAnnouncement />
      <CardRevealEffect />
    </div>
  );
}
