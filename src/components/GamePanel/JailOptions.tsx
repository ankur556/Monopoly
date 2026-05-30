import { useGameStore } from "../../store/gameStore";

/**
 * Shows jail options to the current player when they're in jail during PRE_ROLL.
 * Three options: pay $50 fine, use GOOJF card, or roll for doubles.
 */
export function JailOptions() {
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const turnPhase = useGameStore((s) => s.turnPhase);
  const isRolling = useGameStore((s) => s.isRolling);
  const isMoving = useGameStore((s) => s.isMoving);
  const payJailFine = useGameStore((s) => s.payJailFine);
  const useGetOutOfJailCard = useGameStore((s) => s.useGetOutOfJailCard);
  const rollForJailBreak = useGameStore((s) => s.rollForJailBreak);

  const player = players[currentPlayerIndex];

  if (!player.inJail || turnPhase !== "PRE_ROLL") return null;

  const canAffordFine = player.balance >= 50;
  const hasCard = player.getOutOfJailFreeCards > 0;
  const busy = isRolling || isMoving;

  const attempt = player.jailTurns + 1; // 1-indexed for display

  return (
    <div className="rounded-xl border border-orange-400/40 bg-orange-500/10 p-4 backdrop-blur-sm">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl">🔒</span>
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-orange-300">
            In Jail
          </p>
          <p className="text-[11px] text-orange-200/60">
            Roll attempt {attempt}/3 — must escape by turn 3
          </p>
        </div>
        {/* Jail turn pips */}
        <div className="ml-auto flex gap-1">
          {[1, 2, 3].map((t) => (
            <div
              key={t}
              className={`h-2.5 w-2.5 rounded-full transition ${
                t <= player.jailTurns
                  ? "bg-red-500"
                  : "bg-white/20"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {/* Pay fine */}
        <button
          id="jail-pay-fine-btn"
          type="button"
          disabled={!canAffordFine || busy}
          onClick={payJailFine}
          className="flex w-full items-center justify-between rounded-xl bg-emerald-700/80 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>💵 Pay $50 Fine</span>
          <span className="text-xs opacity-70">${player.balance} avail.</span>
        </button>

        {/* Use card */}
        <button
          id="jail-use-card-btn"
          type="button"
          disabled={!hasCard || busy}
          onClick={useGetOutOfJailCard}
          className="flex w-full items-center justify-between rounded-xl bg-purple-700/80 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>🃏 Use Get Out of Jail Free Card</span>
          <span className="text-xs opacity-70">{player.getOutOfJailFreeCards} held</span>
        </button>

        {/* Roll for doubles */}
        <button
          id="jail-roll-doubles-btn"
          type="button"
          disabled={busy}
          onClick={rollForJailBreak}
          className="flex w-full items-center justify-between rounded-xl bg-blue-700/80 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>🎲 Roll for Doubles</span>
          {attempt >= 3 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider">
              Last chance — fine if fail
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
