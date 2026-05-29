import type { ColorGroup, SquareType } from "../types/game";

export const COLOR_BAND: Record<ColorGroup, string> = {
  brown: "bg-[#8B4513]",
  "light-blue": "bg-[#87CEEB]",
  pink: "bg-[#FF69B4]",
  orange: "bg-[#FF8C00]",
  red: "bg-[#DC143C]",
  yellow: "bg-[#FFD700]",
  green: "bg-[#228B22]",
  "dark-blue": "bg-[#00008B]",
  railroad: "bg-[#2F2F2F]",
  utility: "bg-[#C0C0C0]",
};

export const SPECIAL_SQUARE_STYLE: Record<
  Exclude<SquareType, "property" | "railroad" | "utility">,
  { bg: string; text: string; accent?: string }
> = {
  go: {
    bg: "bg-gradient-to-br from-red-600 to-red-800",
    text: "text-white",
    accent: "GO",
  },
  chance: {
    bg: "bg-gradient-to-br from-amber-400 to-orange-500",
    text: "text-zinc-900",
    accent: "?",
  },
  chest: {
    bg: "bg-gradient-to-br from-sky-400 to-blue-600",
    text: "text-white",
    accent: "CHEST",
  },
  tax: {
    bg: "bg-gradient-to-br from-zinc-300 to-zinc-500",
    text: "text-zinc-900",
  },
  jail: {
    bg: "bg-gradient-to-br from-amber-100 to-amber-300",
    text: "text-zinc-800",
  },
  "free-parking": {
    bg: "bg-gradient-to-br from-emerald-400 to-emerald-700",
    text: "text-white",
  },
  "go-to-jail": {
    bg: "bg-gradient-to-br from-zinc-700 to-zinc-900",
    text: "text-white",
  },
};
