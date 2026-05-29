import { useEffect, useRef } from "react";
import { announcementClass } from "../../lib/events";
import { useGameStore } from "../../store/gameStore";

const DISPLAY_MS = 2400;

/** Maps announcement variant to a glow color for the backdrop */
const VARIANT_GLOW: Record<string, string> = {
  turn: "rgba(52, 211, 153, 0.18)",
  rent: "rgba(251, 191, 36, 0.18)",
  jail: "rgba(248, 113, 113, 0.18)",
  go: "rgba(253, 224, 71, 0.18)",
  card: "rgba(125, 211, 252, 0.18)",
  default: "rgba(255, 255, 255, 0.10)",
};

/**
 * Full-overlay board center announcer.
 * Plays a punchy scale-in → hold → fade-out animation.
 * Variant-specific glow backdrop for extra drama.
 */
export function BoardAnnouncement() {
  const activeAnnouncement = useGameStore((s) => s.activeAnnouncement);
  const variant = useGameStore((s) => s.announcementVariant);
  const clearAnnouncement = useGameStore((s) => s.clearAnnouncement);
  const cardReveal = useGameStore((s) => s.cardReveal);

  // Key to remount the animation element every time a new announcement fires
  const animKeyRef = useRef(0);
  animKeyRef.current += 1;
  const animKey = animKeyRef.current;

  useEffect(() => {
    if (!activeAnnouncement || cardReveal) return;
    const timer = setTimeout(() => clearAnnouncement(), DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [activeAnnouncement, cardReveal, clearAnnouncement]);

  if (!activeAnnouncement || cardReveal) return null;

  const lines = activeAnnouncement.split("\n");
  const glowColor = VARIANT_GLOW[variant] ?? VARIANT_GLOW.default;

  return (
    <div
      key={animKey}
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4"
      aria-live="polite"
    >
      {/* Glow backdrop */}
      <div
        className="absolute inset-0 rounded-md"
        style={{ backgroundColor: glowColor }}
      />

      {/* Text content */}
      <div
        className={`animate-announce-pop relative max-w-[92%] text-center font-black uppercase leading-tight drop-shadow-[0_4px_28px_rgba(0,0,0,0.9)] ${announcementClass(variant)}`}
      >
        {lines.map((line, i) => (
          <p
            key={i}
            className={
              i === 0
                ? "text-xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] sm:text-3xl"
                : "mt-1 text-sm opacity-90 sm:text-xl"
            }
            style={{
              textShadow:
                i === 0
                  ? "0 0 32px currentColor, 0 2px 8px rgba(0,0,0,0.8)"
                  : "0 2px 6px rgba(0,0,0,0.6)",
            }}
          >
            {line}
          </p>
        ))}

        {/* Decorative underline pulse for turn announcements */}
        {variant === "turn" && (
          <div className="mx-auto mt-2 h-0.5 w-16 rounded-full bg-current opacity-60 sm:mt-3 sm:w-24" />
        )}
      </div>
    </div>
  );
}
