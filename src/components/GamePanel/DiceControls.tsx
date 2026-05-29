import { useGameStore } from "../../store/gameStore";

export function DiceControls() {
  const lastRoll = useGameStore((s) => s.lastRoll);
  const pendingAction = useGameStore((s) => s.pendingAction);
  const rollDice = useGameStore((s) => s.rollDice);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={rollDice}
        disabled={pendingAction !== null}
        className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Roll Dice
      </button>
      {lastRoll !== null && (
        <p className="text-sm text-zinc-600">Last roll: {lastRoll}</p>
      )}
    </div>
  );
}
