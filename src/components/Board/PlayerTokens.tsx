import type { Player } from "../../types/game";

const TOKEN_COLORS: Record<string, string> = {
  p1: "bg-blue-600",
  p2: "bg-red-600",
};

interface PlayerTokensProps {
  players: Player[];
  position: number;
}

export function PlayerTokens({ players, position }: PlayerTokensProps) {
  const onSquare = players.filter((p) => p.position === position);

  if (onSquare.length === 0) return null;

  return (
    <div className="mt-auto flex flex-wrap justify-center gap-0.5">
      {onSquare.map((player) => (
        <span
          key={player.id}
          className={`h-2.5 w-2.5 rounded-full border border-white shadow-sm ${TOKEN_COLORS[player.id] ?? "bg-zinc-600"}`}
          title={player.name}
        />
      ))}
    </div>
  );
}
