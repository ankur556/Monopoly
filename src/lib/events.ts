import type { ActionLogEntry, AnnouncementVariant } from "../types/game";

const MAX_LOG_ENTRIES = 24;
let logCounter = 0;
let announcementTimer: ReturnType<typeof setTimeout> | null = null;

export function createLogEntry(text: string): ActionLogEntry {
  logCounter += 1;
  return {
    id: `log-${logCounter}`,
    text,
    timestamp: Date.now(),
  };
}

export function appendActionLog(
  log: ActionLogEntry[],
  text: string,
): ActionLogEntry[] {
  return [...log, createLogEntry(text)].slice(-MAX_LOG_ENTRIES);
}

export function scheduleAnnouncementClear(
  onClear: () => void,
  durationMs = 2000,
): void {
  if (announcementTimer) clearTimeout(announcementTimer);
  announcementTimer = setTimeout(() => {
    onClear();
    announcementTimer = null;
  }, durationMs);
}

export function clearAnnouncementTimer(): void {
  if (announcementTimer) {
    clearTimeout(announcementTimer);
    announcementTimer = null;
  }
}

export function rentAnnouncementThreshold(amount: number): boolean {
  return amount >= 100;
}

export function announcementClass(variant: AnnouncementVariant): string {
  switch (variant) {
    case "turn":
      return "text-emerald-300";
    case "rent":
      return "text-amber-300";
    case "jail":
      return "text-red-400";
    case "card":
      return "text-sky-200";
    case "go":
      return "text-yellow-300";
    default:
      return "text-white";
  }
}
