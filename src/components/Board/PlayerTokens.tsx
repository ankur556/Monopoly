import type { Player } from "../../types/game";

const TOKEN_COLORS: Record<string, string> = {
  p1: "bg-blue-500",
  p2: "bg-red-500",
};

interface PlayerTokensProps {
  players: Player[];
  position: number;
}

export function PlayerTokens({ players, position }: PlayerTokensProps) {
  const onSquare = players.filter((p) => p.position === position);

  if (onSquare.length === 0) return null;

  return (
    <div className="mt-auto flex flex-wrap justify-center gap-1">
      {onSquare.map((player) => (
        <div
          key={player.id}
          className="relative h-3.5 w-3.5"
          title={player.name}
        >
          <span className="absolute inset-0 translate-y-0.5 rounded-full bg-black/35 blur-[1px]" />
          <span
            className={`absolute inset-0 rounded-full shadow-sm ring-2 ring-white/90 ${TOKEN_COLORS[player.id] ?? "bg-zinc-600"}`}
          />
        </div>
      ))}
    </div>
  );
}
