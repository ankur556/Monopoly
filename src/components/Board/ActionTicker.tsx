import { useEffect, useRef } from "react";
import { useGameStore } from "../../store/gameStore";

const VISIBLE_COUNT = 5;

export function ActionTicker() {
  const actionLog = useGameStore((s) => s.actionLog);
  const listRef = useRef<HTMLUListElement>(null);

  const recent = actionLog.slice(-VISIBLE_COUNT);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [actionLog]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-white/15 bg-black/25 px-2 py-2 backdrop-blur-md">
      <p className="mb-1.5 shrink-0 text-[9px] font-bold uppercase tracking-widest text-emerald-300/90 sm:text-[10px]">
        Live Action
      </p>
      <ul
        ref={listRef}
        className="flex min-h-0 flex-1 flex-col justify-end gap-1 overflow-y-auto text-[9px] leading-snug text-white/85 sm:text-[10px]"
      >
        {recent.map((entry) => (
          <li
            key={entry.id}
            className="animate-ticker-in border-l-2 border-emerald-400/60 pl-1.5"
          >
            {entry.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
