import { useEffect } from "react";
import { announcementClass } from "../../lib/events";
import { useGameStore } from "../../store/gameStore";

const DISPLAY_MS = 2000;

export function BoardAnnouncement() {
  const activeAnnouncement = useGameStore((s) => s.activeAnnouncement);
  const variant = useGameStore((s) => s.announcementVariant);
  const clearAnnouncement = useGameStore((s) => s.clearAnnouncement);
  const cardReveal = useGameStore((s) => s.cardReveal);

  useEffect(() => {
    if (!activeAnnouncement || cardReveal) return;
    const timer = setTimeout(() => clearAnnouncement(), DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [activeAnnouncement, cardReveal, clearAnnouncement]);

  if (!activeAnnouncement || cardReveal) return null;

  const lines = activeAnnouncement.split("\n");

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4"
      aria-live="polite"
    >
      <div
        className={`animate-announce-pop max-w-[90%] text-center font-black uppercase leading-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)] ${announcementClass(variant)}`}
      >
        {lines.map((line, i) => (
          <p
            key={i}
            className={i === 0 ? "text-lg sm:text-2xl" : "mt-1 text-sm sm:text-lg"}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
