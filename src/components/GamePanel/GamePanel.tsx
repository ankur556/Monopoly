import { useGameStore } from "../../store/gameStore";
import { DiceControls } from "./DiceControls";
import { PlayerCard } from "./PlayerCard";
import { PropertyActions } from "./PropertyActions";

export function GamePanel() {
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const message = useGameStore((s) => s.message);

  return (
    <aside className="flex w-full max-w-sm flex-col gap-4 lg:max-w-xs">
      <h2 className="text-lg font-bold text-zinc-900">Game Controls</h2>

      <div className="flex flex-col gap-2">
        {players.map((player, index) => (
          <PlayerCard
            key={player.id}
            player={player}
            isCurrent={index === currentPlayerIndex}
          />
        ))}
      </div>

      <DiceControls />
      <PropertyActions />

      <p className="rounded-lg bg-white p-3 text-sm text-zinc-700 shadow-sm">
        {message}
      </p>
    </aside>
  );
}
