import { ActionTicker } from "./ActionTicker";
import { BoardAnnouncement } from "./BoardAnnouncement";
import { CardRevealEffect } from "./CardRevealEffect";

export function BoardCenter() {
  return (
    <div
      className="relative flex min-h-0 flex-col overflow-hidden rounded-md"
      style={{
        gridColumn: "2 / 11",
        gridRow: "2 / 11",
        backgroundColor: "var(--board-felt)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06)_0%,transparent_70%)]" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col p-2 sm:p-3">
        <div className="mb-2 shrink-0 text-center">
          <span className="text-sm font-black tracking-[0.25em] text-emerald-100/90 sm:text-base">
            MONOPOLY
          </span>
        </div>
        <div className="min-h-0 flex-1">
          <ActionTicker />
        </div>
      </div>

      <BoardAnnouncement />
      <CardRevealEffect />
    </div>
  );
}
