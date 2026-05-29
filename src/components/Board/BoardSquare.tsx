import { CORNER_LABELS } from "../../data/boardLayout";
import type { Player, Property } from "../../types/game";
import { PlayerTokens } from "./PlayerTokens";

const OWNER_TINT: Record<string, string> = {
  p1: "bg-blue-100",
  p2: "bg-red-100",
};

interface BoardSquareProps {
  position: number;
  property?: Property;
  players: Player[];
}

export function BoardSquare({ position, property, players }: BoardSquareProps) {
  const cornerLabel = CORNER_LABELS[position];
  const ownerTint = property?.ownerId
    ? OWNER_TINT[property.ownerId]
    : "bg-white";

  return (
    <div
      className={`flex min-h-10 min-w-0 flex-col border border-zinc-400 p-0.5 text-[8px] leading-tight sm:min-h-12 sm:text-[9px] ${ownerTint}`}
    >
      <span className="font-semibold text-zinc-500">{position}</span>
      <span className="truncate font-medium text-zinc-800">
        {property?.name ?? cornerLabel ?? ""}
      </span>
      <PlayerTokens players={players} position={position} />
    </div>
  );
}
