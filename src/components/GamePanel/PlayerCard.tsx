import type { Player } from "../../types/game";

const ACCENT: Record<string, string> = {
  p1: "ring-blue-400 shadow-blue-500/30",
  p2: "ring-red-400 shadow-red-500/30",
};

const AVATAR: Record<string, string> = {
  p1: "bg-blue-500",
  p2: "bg-red-500",
};

interface PlayerCardProps {
  player: Player;
  isCurrent: boolean;
}

export function PlayerCard({ player, isCurrent }: PlayerCardProps) {
  return (
    <div
      className={`rounded-xl border p-3 transition ${
        isCurrent
          ? `ring-2 shadow-lg ${ACCENT[player.id] ?? "ring-emerald-400"}`
          : "opacity-85"
      }`}
      style={{
        backgroundColor: "var(--glass-bg)",
        borderColor: "var(--glass-border)",
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className={`h-8 w-8 shrink-0 rounded-full shadow-md ring-2 ring-white/80 ${AVATAR[player.id] ?? "bg-zinc-500"}`}
        />
        <div>
          <p className="font-semibold">{player.name}</p>
          <p className="text-sm opacity-70">Balance: ${player.balance}</p>
          <p className="text-sm opacity-70">Position: {player.position}</p>
        </div>
      </div>
    </div>
  );
}
