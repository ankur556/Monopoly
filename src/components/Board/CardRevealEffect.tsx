import { useEffect } from "react";
import { useGameStore } from "../../store/gameStore";

const REVEAL_DELAY_MS = 900;

export function CardRevealEffect() {
  const cardReveal = useGameStore((s) => s.cardReveal);
  const completeCardReveal = useGameStore((s) => s.completeCardReveal);

  useEffect(() => {
    if (!cardReveal) return;
    const timer = setTimeout(() => completeCardReveal(), REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [cardReveal, completeCardReveal]);

  if (!cardReveal) return null;

  const isChance = cardReveal.kind === "chance";

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-3">
      <div
        className={`animate-card-slide-up w-full max-w-[85%] rounded-xl border-2 px-4 py-4 shadow-2xl ${
          isChance
            ? "border-amber-400/80 bg-gradient-to-br from-amber-500 to-orange-600 text-zinc-900"
            : "border-sky-300/80 bg-gradient-to-br from-sky-400 to-blue-600 text-white"
        }`}
      >
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] opacity-90 sm:text-xs">
          {cardReveal.title}
        </p>
        <p className="mt-2 text-center text-xs font-semibold leading-snug sm:text-sm">
          {cardReveal.body}
        </p>
      </div>
    </div>
  );
}
