import { useCallback } from "react";
import { useGameStore } from "../../store/gameStore";

function DieCube({
  value,
  rolling,
}: {
  value: number;
  rolling: boolean;
}) {
  const display = Math.min(6, Math.max(1, value));

  return (
    <div
      className={`preserve-3d relative h-16 w-16 ${rolling ? "animate-dice-tumble" : ""}`}
    >
      <div
        className="die-face backface-hidden absolute inset-0 flex items-center justify-center rounded-xl border-2 shadow-lg"
        style={{ transform: "translateZ(32px)" }}
      >
        <span className="die-value text-2xl font-bold">{display}</span>
      </div>
      <div
        className="die-face backface-hidden absolute inset-0 flex items-center justify-center rounded-xl border-2 shadow-lg"
        style={{ transform: "rotateY(180deg) translateZ(32px)" }}
      >
        <span className="die-value text-2xl font-bold">{((display % 6) + 1)}</span>
      </div>
      <div
        className="die-face backface-hidden absolute inset-0 flex items-center justify-center rounded-xl border-2 shadow-lg"
        style={{ transform: "rotateY(90deg) translateZ(32px)" }}
      >
        <span className="die-value text-2xl font-bold">6</span>
      </div>
      <div
        className="die-face backface-hidden absolute inset-0 flex items-center justify-center rounded-xl border-2 shadow-lg"
        style={{ transform: "rotateY(-90deg) translateZ(32px)" }}
      >
        <span className="die-value text-2xl font-bold">1</span>
      </div>
      <div
        className="die-face backface-hidden absolute inset-0 flex items-center justify-center rounded-xl border-2 shadow-lg"
        style={{ transform: "rotateX(90deg) translateZ(32px)" }}
      >
        <span className="die-value text-2xl font-bold">3</span>
      </div>
      <div
        className="die-face backface-hidden absolute inset-0 flex items-center justify-center rounded-xl border-2 shadow-lg"
        style={{ transform: "rotateX(-90deg) translateZ(32px)" }}
      >
        <span className="die-value text-2xl font-bold">4</span>
      </div>
    </div>
  );
}

export function DiceRoller3D() {
  const lastRoll = useGameStore((s) => s.lastRoll);
  const lastDie1 = useGameStore((s) => s.lastDie1);
  const lastDie2 = useGameStore((s) => s.lastDie2);
  const pendingAction = useGameStore((s) => s.pendingAction);
  const tradeStatus = useGameStore((s) => s.trade.status);
  const cardReveal = useGameStore((s) => s.cardReveal);
  const isRolling = useGameStore((s) => s.isRolling);
  const isMoving = useGameStore((s) => s.isMoving);
  const rollDice = useGameStore((s) => s.rollDice);

  const auctionStatus = useGameStore((s) => s.auction.status);

  const disabled =
    pendingAction !== null ||
    tradeStatus !== "idle" ||
    auctionStatus !== "idle" ||
    isRolling ||
    isMoving ||
    cardReveal !== null;

  const die1 = lastDie1 ?? 1;
  const die2 = lastDie2 ?? 1;

  const handleRoll = useCallback(() => {
    if (disabled) return;
    rollDice();
  }, [disabled, rollDice]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="preserve-3d perspective-1000 flex gap-5">
        <DieCube value={die1} rolling={isRolling} />
        <DieCube value={die2} rolling={isRolling} />
      </div>
      <button
        type="button"
        onClick={handleRoll}
        disabled={disabled}
        className="w-full rounded-xl bg-emerald-700 px-4 py-2.5 font-semibold text-white shadow-lg transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Roll Dice
      </button>
      {lastRoll !== null && !isRolling && (
        <p className="text-sm opacity-70">
          Last roll: {lastDie1} + {lastDie2} = {lastRoll}
        </p>
      )}
    </div>
  );
}
