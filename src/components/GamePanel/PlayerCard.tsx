import type { Player } from "../../types/game";

const ACCENT: Record<string, string> = {
  p1: "ring-blue-500",
  p2: "ring-red-500",
};

interface PlayerCardProps {
  player: Player;
  isCurrent: boolean;
}

export function PlayerCard({ player, isCurrent }: PlayerCardProps) {
  return (
    <div
      className={`rounded-lg border border-zinc-300 bg-white p-3 ${
        isCurrent ? `ring-2 ${ACCENT[player.id] ?? "ring-zinc-400"}` : ""
      }`}
    >
      <p className="font-semibold text-zinc-900">{player.name}</p>
      <p className="text-sm text-zinc-600">Balance: ${player.balance}</p>
      <p className="text-sm text-zinc-600">Position: {player.position}</p>
    </div>
  );
}
