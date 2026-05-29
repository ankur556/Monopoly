import { useEffect, useState } from "react";
import type { Player } from "../../types/game";

/** Classic Monopoly token icons mapped to each player */
const TOKEN_ICONS: Record<string, string> = {
  p1: "🎩", // top hat
  p2: "🚗", // race car
};

/** Vibrant gradient backgrounds for each token */
const TOKEN_GRADIENT: Record<string, string> = {
  p1: "from-blue-500 to-indigo-700",
  p2: "from-rose-500 to-red-700",
};

/** Ring glow color per player */
const TOKEN_RING: Record<string, string> = {
  p1: "ring-blue-300",
  p2: "ring-rose-300",
};

interface PlayerTokensProps {
  players: Player[];
  position: number;
}

/**
 * Renders beautiful game-piece tokens on a given square.
 * Each token plays an elastic `token-land` bounce animation on every step.
 */
export function PlayerTokens({ players, position }: PlayerTokensProps) {
  const onSquare = players.filter((p) => p.position === position);
  if (onSquare.length === 0) return null;

  return (
    <div className="mt-auto flex flex-wrap justify-center gap-0.5 pb-0.5">
      {onSquare.map((player) => (
        <AnimatedToken key={player.id} player={player} />
      ))}
    </div>
  );
}

/** Individual animated game piece token */
function AnimatedToken({ player }: { player: Player }) {
  const [animKey, setAnimKey] = useState(0);
  const [prevPosition, setPrevPosition] = useState(player.position);

  useEffect(() => {
    if (player.position !== prevPosition) {
      setAnimKey((k) => k + 1);
      setPrevPosition(player.position);
    }
  }, [player.position, prevPosition]);

  const gradient = TOKEN_GRADIENT[player.id] ?? "from-zinc-500 to-zinc-700";
  const ring = TOKEN_RING[player.id] ?? "ring-white";
  const icon = TOKEN_ICONS[player.id] ?? "🎲";

  return (
    <div className="relative" title={player.name}>
      {/* Cast shadow beneath token */}
      <span
        className="absolute inset-x-0 bottom-0 mx-auto h-1 w-3.5 translate-y-0.5 rounded-full bg-black/40 blur-[2px]"
      />
      {/* Token body — gradient pill with icon */}
      <span
        key={animKey}
        className={`
          relative flex h-5 w-5 items-center justify-center
          rounded-full bg-gradient-to-br ${gradient}
          ring-2 ${ring} ring-offset-1 ring-offset-transparent
          shadow-lg animate-token-land
          text-[9px] leading-none
          sm:h-5 sm:w-5 sm:text-[10px]
        `}
        style={{
          textShadow: "0 1px 2px rgba(0,0,0,0.6)",
          filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.4))",
        }}
      >
        {icon}
      </span>
    </div>
  );
}
