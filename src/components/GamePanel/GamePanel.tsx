import { useGameStore } from "../../store/gameStore";
import { GlassPanel } from "../ui/GlassPanel";
import { DiceControls } from "./DiceControls";
import { LedgerPanel } from "./LedgerPanel";
import { PlayerCard } from "./PlayerCard";
import { PropertyActions } from "./PropertyActions";

export function GamePanel() {
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const message = useGameStore((s) => s.message);
  const pendingAction = useGameStore((s) => s.pendingAction);
  const trade = useGameStore((s) => s.trade);
  const turnNumber = useGameStore((s) => s.turnNumber);
  const openTrade = useGameStore((s) => s.openTrade);

  const tradeBlocked =
    pendingAction !== null || trade.status !== "idle";
  const tradeOfferReceiver =
    trade.status === "pending" && trade.offer
      ? players.find((p) => p.id === trade.offer!.receiverId)
      : null;

  return (
    <GlassPanel className="flex w-full max-w-sm flex-col gap-4 p-5 lg:max-w-xs">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Game Controls</h2>
        <span className="text-xs opacity-60">Turn {turnNumber}</span>
      </div>

      {trade.status === "pending" && tradeOfferReceiver && (
        <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-200">
          Trade offer awaiting {tradeOfferReceiver.name}
        </p>
      )}

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

      <button
        type="button"
        onClick={openTrade}
        disabled={tradeBlocked}
        className="w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ borderColor: "var(--glass-border)" }}
      >
        Propose Trade
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
