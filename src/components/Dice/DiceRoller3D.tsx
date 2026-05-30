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
  const endTurn = useGameStore((s) => s.endTurn);
  const turnPhase = useGameStore((s) => s.turnPhase);
  const auctionStatus = useGameStore((s) => s.auction.status);
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);

  const currentPlayer = players[currentPlayerIndex];
  const isInJail = currentPlayer.inJail;

  // Roll button: only in PRE_ROLL and not in jail (jail uses JailOptions)
  const canRoll =
    turnPhase === "PRE_ROLL" &&
    !isInJail &&
    !pendingAction &&
    tradeStatus === "idle" &&
    auctionStatus === "idle" &&
    !isRolling &&
    !isMoving &&
    !cardReveal;

  // End Turn button: only in POST_ROLL, no blocking state
  const canEndTurn =
    turnPhase === "POST_ROLL" &&
    !pendingAction &&
    tradeStatus === "idle" &&
    auctionStatus === "idle" &&
    !isRolling &&
    !isMoving &&
    !cardReveal;

  const die1 = lastDie1 ?? 1;
  const die2 = lastDie2 ?? 1;
  const isDoubles = lastDie1 !== null && lastDie1 === lastDie2 && turnPhase === "PRE_ROLL";

  const handleRoll = useCallback(() => {
    if (!canRoll) return;
    rollDice();
  }, [canRoll, rollDice]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Dice cubes */}
      <div className="preserve-3d perspective-1000 flex gap-5">
        <DieCube value={die1} rolling={isRolling} />
        <DieCube value={die2} rolling={isRolling} />
      </div>

      {/* Last roll + doubles badge */}
      {lastRoll !== null && !isRolling && (
        <div className="flex items-center gap-2">
          <p className="text-sm opacity-70">
            {lastDie1} + {lastDie2} = <span className="font-bold">{lastRoll}</span>
          </p>
          {isDoubles && (
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-900">
              Doubles! Roll again
            </span>
          )}
        </div>
      )}

      {/* Roll Dice button — PRE_ROLL only, not in jail */}
      {(turnPhase === "PRE_ROLL" || turnPhase === "ROLLING") && !isInJail && (
        <button
          id="roll-dice-btn"
          type="button"
          onClick={handleRoll}
          disabled={!canRoll}
          className="w-full rounded-xl bg-emerald-700 px-4 py-2.5 font-semibold text-white shadow-lg transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRolling || isMoving ? "Moving…" : "🎲 Roll Dice"}
        </button>
      )}

      {/* End Turn button — POST_ROLL only */}
      {turnPhase === "POST_ROLL" && (
        <button
          id="end-turn-btn"
          type="button"
          onClick={endTurn}
          disabled={!canEndTurn}
          className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 font-bold text-white shadow-lg transition hover:from-violet-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ✓ End Turn
        </button>
      )}
    </div>
  );
}
