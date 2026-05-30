import { useGameStore } from "../../store/gameStore";
import { GlassPanel } from "../ui/GlassPanel";
import { DiceControls } from "./DiceControls";
import { JailOptions } from "./JailOptions";
import { LedgerPanel } from "./LedgerPanel";
import { PlayerCard } from "./PlayerCard";
import { PropertyActions } from "./PropertyActions";
import { PropertyPortfolio } from "./PropertyPortfolio";

export function GamePanel() {
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const message = useGameStore((s) => s.message);
  const pendingAction = useGameStore((s) => s.pendingAction);
  const trade = useGameStore((s) => s.trade);
  const turnNumber = useGameStore((s) => s.turnNumber);
  const openTrade = useGameStore((s) => s.openTrade);
  const isMoving = useGameStore((s) => s.isMoving);
  const isRolling = useGameStore((s) => s.isRolling);
  const cardReveal = useGameStore((s) => s.cardReveal);
  const auctionStatus = useGameStore((s) => s.auction.status);
  const turnPhase = useGameStore((s) => s.turnPhase);

  // Trade is blocked only during movement, card reveal, pending buy, or active auction
  const tradeBlocked =
    !!pendingAction ||
    trade.status !== "idle" ||
    isMoving ||
    isRolling ||
    !!cardReveal ||
    auctionStatus !== "idle";

  const tradeOfferReceiver =
    trade.status === "pending" && trade.offer
      ? players.find((p) => p.id === trade.offer!.receiverId)
      : null;

  const phaseLabel: Record<string, string> = {
    PRE_ROLL: "Roll phase",
    ROLLING: "Moving…",
    POST_ROLL: "End turn when ready",
  };

  return (
    <GlassPanel className="flex w-full max-w-sm flex-col gap-4 p-5 lg:max-w-xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Game Controls</h2>
        <div className="text-right">
          <span className="block text-xs opacity-60">Turn {turnNumber}</span>
          <span
            className={`block text-[9px] font-black uppercase tracking-widest ${
              turnPhase === "PRE_ROLL"
                ? "text-emerald-400"
                : turnPhase === "ROLLING"
                  ? "text-amber-400"
                  : "text-violet-400"
            }`}
          >
            {phaseLabel[turnPhase]}
          </span>
        </div>
      </div>

      {/* Trade offer notification */}
      {trade.status === "pending" && tradeOfferReceiver && (
        <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-200">
          Trade offer awaiting {tradeOfferReceiver.name}
        </p>
      )}

      {/* Player cards */}
      <div className="flex flex-col gap-2">
        {players.map((player, index) => (
          <PlayerCard
            key={player.id}
            player={player}
            isCurrent={index === currentPlayerIndex}
          />
        ))}
      </div>

      {/* Jail options — shown when current player is in jail PRE_ROLL */}
      <JailOptions />

      {/* Dice / End Turn controls */}
      <DiceControls />

      {/* Property buy/pass actions */}
      <PropertyActions />

      {/* Movement progress indicator */}
      {(isMoving || isRolling) && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-2">
          <span className="animate-bounce text-base">🎲</span>
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            Token moving…
          </span>
        </div>
      )}

      {/* Property Portfolio — house building */}
      <PropertyPortfolio />

      {/* Trade button — available in PRE_ROLL and POST_ROLL */}
      <button
        id="propose-trade-btn"
        type="button"
        onClick={openTrade}
        disabled={tradeBlocked}
        className="w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ borderColor: "var(--glass-border)" }}
      >
        🤝 Propose Trade
      </button>

      <LedgerPanel />

      <p
        className="rounded-xl border px-3 py-3 text-sm leading-relaxed"
        style={{
          backgroundColor: "var(--glass-bg)",
          borderColor: "var(--glass-border)",
        }}
      >
        {message}
      </p>
    </GlassPanel>
  );
}
