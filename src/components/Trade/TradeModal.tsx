import { useGameStore } from "../../store/gameStore";
import { GlassPanel } from "../ui/GlassPanel";
import { TradePropertyList } from "./TradePropertyList";

export function TradeModal() {
  const trade = useGameStore((s) => s.trade);
  const players = useGameStore((s) => s.players);
  const squares = useGameStore((s) => s.squares);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const updateTradeDraft = useGameStore((s) => s.updateTradeDraft);
  const sendTradeOffer = useGameStore((s) => s.sendTradeOffer);
  const acceptTrade = useGameStore((s) => s.acceptTrade);
  const declineTrade = useGameStore((s) => s.declineTrade);
  const counterTrade = useGameStore((s) => s.counterTrade);
  const cancelTrade = useGameStore((s) => s.cancelTrade);

  if (trade.status === "idle") return null;

  const currentPlayer = players[currentPlayerIndex];
  const draft = trade.draft;
  const offer = trade.offer;

  const isComposing = trade.status === "composing" && draft;
  const isPending = trade.status === "pending" && offer;

  const composingAsSender =
    isComposing && draft.senderId === currentPlayer.id;
  const pendingAsReceiver =
    isPending && offer.receiverId === currentPlayer.id;
  const pendingAsSender =
    isPending && offer.senderId === currentPlayer.id;

  const sender = isComposing
    ? players.find((p) => p.id === draft!.senderId)!
    : players.find((p) => p.id === offer!.senderId)!;
  const receiver = isComposing
    ? players.find((p) => p.id === draft!.receiverId)!
    : players.find((p) => p.id === offer!.receiverId)!;

  const isTradable = (s: (typeof squares)[0]) =>
    s.type === "property" || s.type === "railroad" || s.type === "utility";

  const senderProps = squares.filter(
    (p) => p.ownerId === sender.id && isTradable(p),
  );
  const receiverProps = squares.filter(
    (p) => p.ownerId === receiver.id && isTradable(p),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
      <GlassPanel className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <h2 className="text-xl font-bold">Trade Negotiation</h2>

        {isComposing && composingAsSender && (
          <>
            <p className="mt-1 text-sm opacity-70">
              Propose a deal with {receiver.name}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  You offer
                </p>
                <label className="block text-sm">
                  Cash
                  <input
                    type="number"
                    min={0}
                    max={sender.balance}
                    value={draft.moneyOfferedBySender}
                    onChange={(e) =>
                      updateTradeDraft({
                        moneyOfferedBySender: Math.max(
                          0,
                          Number(e.target.value) || 0,
                        ),
                      })
                    }
                    className="mt-1 w-full rounded-lg border bg-white/50 px-3 py-2 dark:bg-zinc-900/50"
                    style={{ borderColor: "var(--glass-border)" }}
                  />
                </label>
                <TradePropertyList
                  title="Your properties"
                  properties={senderProps}
                  selectedIds={draft.propertiesOfferedBySender}
                  onChange={(ids) =>
                    updateTradeDraft({ propertiesOfferedBySender: ids })
                  }
                />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  You want
                </p>
                <label className="block text-sm">
                  Cash from opponent
                  <input
                    type="number"
                    min={0}
                    max={receiver.balance}
                    value={draft.moneyOfferedByReceiver}
                    onChange={(e) =>
                      updateTradeDraft({
                        moneyOfferedByReceiver: Math.max(
                          0,
                          Number(e.target.value) || 0,
                        ),
                      })
                    }
                    className="mt-1 w-full rounded-lg border bg-white/50 px-3 py-2 dark:bg-zinc-900/50"
                    style={{ borderColor: "var(--glass-border)" }}
                  />
                </label>
                <TradePropertyList
                  title={`${receiver.name}'s properties`}
                  properties={receiverProps}
                  selectedIds={draft.propertiesOfferedByReceiver}
                  onChange={(ids) =>
                    updateTradeDraft({ propertiesOfferedByReceiver: ids })
                  }
                />
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={sendTradeOffer}
                className="flex-1 rounded-xl bg-emerald-700 px-4 py-2.5 font-semibold text-white hover:bg-emerald-600"
              >
                Send Offer
              </button>
              <button
                type="button"
                onClick={cancelTrade}
                className="rounded-xl border px-4 py-2.5 font-semibold hover:opacity-80"
                style={{ borderColor: "var(--glass-border)" }}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {isComposing && !composingAsSender && (
          <p className="mt-4 text-sm opacity-70">
            Waiting for the other player to finish composing…
          </p>
        )}

        {isPending && (
          <>
            <p className="mt-1 text-sm opacity-70">
              {sender.name} proposes a trade with {receiver.name}
            </p>
            <TradeSummary offer={offer} squares={squares} players={players} />
            {pendingAsReceiver && (
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={acceptTrade}
                  className="flex-1 rounded-xl bg-emerald-700 px-4 py-2.5 font-semibold text-white hover:bg-emerald-600"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={counterTrade}
                  className="flex-1 rounded-xl bg-amber-600 px-4 py-2.5 font-semibold text-white hover:bg-amber-500"
                >
                  Counter
                </button>
                <button
                  type="button"
                  onClick={declineTrade}
                  className="flex-1 rounded-xl border px-4 py-2.5 font-semibold hover:opacity-80"
                  style={{ borderColor: "var(--glass-border)" }}
                >
                  Decline
                </button>
              </div>
            )}
            {pendingAsSender && (
              <p className="mt-4 text-sm font-medium text-amber-700 dark:text-amber-300">
                Waiting for {receiver.name} to respond…
              </p>
            )}
          </>
        )}
      </GlassPanel>
    </div>
  );
}

function TradeSummary({
  offer,
  squares,
  players,
}: {
  offer: import("../../types/game").TradeOffer;
  squares: import("../../types/game").BoardSquare[];
  players: import("../../types/game").Player[];
}) {
  const sender = players.find((p) => p.id === offer.senderId)!;
  const receiver = players.find((p) => p.id === offer.receiverId)!;

  const propName = (id: string) =>
    squares.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
      <div className="rounded-xl bg-white/20 p-3 dark:bg-black/20">
        <p className="font-semibold">{sender.name} gives</p>
        <p>${offer.moneyOfferedBySender}</p>
        <ul className="mt-1 list-inside list-disc opacity-80">
          {offer.propertiesOfferedBySender.map((id) => (
            <li key={id}>{propName(id)}</li>
          ))}
          {offer.propertiesOfferedBySender.length === 0 && (
            <li className="list-none opacity-50">No properties</li>
          )}
        </ul>
      </div>
      <div className="rounded-xl bg-white/20 p-3 dark:bg-black/20">
        <p className="font-semibold">{receiver.name} gives</p>
        <p>${offer.moneyOfferedByReceiver}</p>
        <ul className="mt-1 list-inside list-disc opacity-80">
          {offer.propertiesOfferedByReceiver.map((id) => (
            <li key={id}>{propName(id)}</li>
          ))}
          {offer.propertiesOfferedByReceiver.length === 0 && (
            <li className="list-none opacity-50">No properties</li>
          )}
        </ul>
      </div>
    </div>
  );
}
