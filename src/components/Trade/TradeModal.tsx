import React from "react";
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

  const [actingAsReceiver, setActingAsReceiver] = React.useState(false);
  React.useEffect(() => {
    if (trade.status === "pending" && trade.offer) {
      setActingAsReceiver(true);
    } else {
      setActingAsReceiver(false);
    }
  }, [trade.status, trade.offer]);

  if (trade.status === "idle") return null;

  const currentPlayer = players[currentPlayerIndex];
  const draft = trade.draft;
  const offer = trade.offer;

  const isComposing = trade.status === "composing" && draft;
  const isPending = trade.status === "pending" && offer;

  const composingAsSender = isComposing && draft.senderId === currentPlayer.id;
  const showResponseControls = isPending && offer && (offer.receiverId === currentPlayer.id || actingAsReceiver);
  const pendingAsSender = isPending && offer && offer.senderId === currentPlayer.id;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <GlassPanel className="max-h-[92vh] w-full max-w-xl overflow-y-auto p-6">

        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-xl shadow-lg">
            🤝
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight">Trade Negotiation</h2>
            <p className="text-xs opacity-60">
              {isComposing
                ? `${sender.name} → ${receiver.name}`
                : `${sender.name} made an offer to ${receiver.name}`}
            </p>
          </div>
        </div>

        {/* COMPOSING VIEW */}
        {isComposing && composingAsSender && (
          <>
            {/* Deal Board */}
            <div className="grid gap-4 sm:grid-cols-2">

              {/* YOU OFFER column */}
              <div className="rounded-2xl border border-blue-400/30 bg-blue-500/10 p-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-400">
                  <span className="text-base">🎩</span> You Offer
                </p>

                {/* Cash slider */}
                <div className="mb-4">
                  <label className="mb-1 block text-xs font-semibold text-blue-300">
                    Cash — ${draft.moneyOfferedBySender.toLocaleString()}
                  </label>
                  <input
                    id="sender-cash-slider"
                    type="range"
                    min={0}
                    max={sender.balance}
                    step={10}
                    value={draft.moneyOfferedBySender}
                    onChange={(e) =>
                      updateTradeDraft({ moneyOfferedBySender: Number(e.target.value) })
                    }
                    className="w-full accent-blue-400"
                  />
                  <input
                    id="sender-cash-input"
                    type="number"
                    min={0}
                    max={sender.balance}
                    value={draft.moneyOfferedBySender}
                    onChange={(e) =>
                      updateTradeDraft({
                        moneyOfferedBySender: Math.min(
                          sender.balance,
                          Math.max(0, Number(e.target.value) || 0),
                        ),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-blue-400/30 bg-blue-900/30 px-3 py-1.5 text-sm text-white placeholder:opacity-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="$0"
                  />
                  <p className="mt-1 text-[10px] opacity-50">
                    Your balance: ${sender.balance.toLocaleString()}
                  </p>
                </div>

                {/* Properties */}
                <TradePropertyList
                  title="Your properties"
                  properties={senderProps}
                  selectedIds={draft.propertiesOfferedBySender}
                  onChange={(ids) => updateTradeDraft({ propertiesOfferedBySender: ids })}
                />

                {/* GOOJF Cards */}
                {sender.getOutOfJailFreeCards > 0 && (
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-semibold text-blue-300">
                      🃏 Get Out of Jail Free cards ({sender.getOutOfJailFreeCards} held)
                    </label>
                    <input
                      id="sender-goojf-input"
                      type="number"
                      min={0}
                      max={sender.getOutOfJailFreeCards}
                      value={draft.jailCardsOfferedBySender ?? 0}
                      onChange={(e) =>
                        updateTradeDraft({
                          jailCardsOfferedBySender: Math.min(
                            sender.getOutOfJailFreeCards,
                            Math.max(0, Number(e.target.value) || 0),
                          ),
                        })
                      }
                      className="w-full rounded-lg border border-blue-400/30 bg-blue-900/30 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                )}
              </div>

              {/* YOU WANT column */}
              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-400">
                  <span className="text-base">🚗</span> You Want
                </p>

                {/* Cash slider */}
                <div className="mb-4">
                  <label className="mb-1 block text-xs font-semibold text-amber-300">
                    Cash from {receiver.name} — ${draft.moneyOfferedByReceiver.toLocaleString()}
                  </label>
                  <input
                    id="receiver-cash-slider"
                    type="range"
                    min={0}
                    max={receiver.balance}
                    step={10}
                    value={draft.moneyOfferedByReceiver}
                    onChange={(e) =>
                      updateTradeDraft({ moneyOfferedByReceiver: Number(e.target.value) })
                    }
                    className="w-full accent-amber-400"
                  />
                  <input
                    id="receiver-cash-input"
                    type="number"
                    min={0}
                    max={receiver.balance}
                    value={draft.moneyOfferedByReceiver}
                    onChange={(e) =>
                      updateTradeDraft({
                        moneyOfferedByReceiver: Math.min(
                          receiver.balance,
                          Math.max(0, Number(e.target.value) || 0),
                        ),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-amber-400/30 bg-amber-900/30 px-3 py-1.5 text-sm text-white placeholder:opacity-50 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    placeholder="$0"
                  />
                  <p className="mt-1 text-[10px] opacity-50">
                    Their balance: ${receiver.balance.toLocaleString()}
                  </p>
                </div>

                {/* Properties */}
                <TradePropertyList
                  title={`${receiver.name}'s properties`}
                  properties={receiverProps}
                  selectedIds={draft.propertiesOfferedByReceiver}
                  onChange={(ids) => updateTradeDraft({ propertiesOfferedByReceiver: ids })}
                />

                {/* GOOJF Cards */}
                {receiver.getOutOfJailFreeCards > 0 && (
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-semibold text-amber-300">
                      🃏 GOOJF cards from {receiver.name} ({receiver.getOutOfJailFreeCards} held)
                    </label>
                    <input
                      id="receiver-goojf-input"
                      type="number"
                      min={0}
                      max={receiver.getOutOfJailFreeCards}
                      value={draft.jailCardsOfferedByReceiver ?? 0}
                      onChange={(e) =>
                        updateTradeDraft({
                          jailCardsOfferedByReceiver: Math.min(
                            receiver.getOutOfJailFreeCards,
                            Math.max(0, Number(e.target.value) || 0),
                          ),
                        })
                      }
                      className="w-full rounded-lg border border-amber-400/30 bg-amber-900/30 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Deal summary strip */}
            <div className="mt-4 rounded-xl bg-white/8 px-4 py-3 text-sm">
              <p className="font-semibold text-emerald-300">Deal Summary</p>
              <p className="mt-1 text-xs opacity-70">
                You give: <strong className="text-white">${draft.moneyOfferedBySender}</strong>
                {draft.propertiesOfferedBySender.length > 0 && (
                  <> + <strong className="text-white">{draft.propertiesOfferedBySender.length} propert{draft.propertiesOfferedBySender.length > 1 ? "ies" : "y"}</strong></>
                )}
                {(draft.jailCardsOfferedBySender ?? 0) > 0 && (
                  <> + <strong className="text-white">{draft.jailCardsOfferedBySender} GOOJF card{draft.jailCardsOfferedBySender! > 1 ? "s" : ""}</strong></>
                )}
                {" · "}
                You get: <strong className="text-white">${draft.moneyOfferedByReceiver}</strong>
                {draft.propertiesOfferedByReceiver.length > 0 && (
                  <> + <strong className="text-white">{draft.propertiesOfferedByReceiver.length} propert{draft.propertiesOfferedByReceiver.length > 1 ? "ies" : "y"}</strong></>
                )}
                {(draft.jailCardsOfferedByReceiver ?? 0) > 0 && (
                  <> + <strong className="text-white">{draft.jailCardsOfferedByReceiver} GOOJF card{draft.jailCardsOfferedByReceiver! > 1 ? "s" : ""}</strong></>
                )}
              </p>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                id="send-trade-offer-btn"
                type="button"
                onClick={sendTradeOffer}
                className="flex-1 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 px-4 py-2.5 font-bold text-white shadow-lg transition hover:from-emerald-500 hover:to-emerald-700"
              >
                📨 Send Offer
              </button>
              <button
                id="cancel-trade-btn"
                type="button"
                onClick={cancelTrade}
                className="rounded-xl border px-4 py-2.5 font-semibold opacity-70 hover:opacity-100"
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

        {/* PENDING OFFER VIEW */}
        {isPending && (
          <>
            <TradeSummary offer={offer} squares={squares} players={players} />

            {showResponseControls ? (
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  id="accept-trade-btn"
                  type="button"
                  onClick={() => acceptTrade(receiver.id)}
                  className="flex-1 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 px-4 py-2.5 font-bold text-white shadow-lg transition hover:opacity-90"
                >
                  ✅ Accept
                </button>
                <button
                  id="counter-trade-btn"
                  type="button"
                  onClick={() => counterTrade(receiver.id)}
                  className="flex-1 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 px-4 py-2.5 font-bold text-white shadow-lg transition hover:opacity-90"
                >
                  🔄 Counter
                </button>
                <button
                  id="decline-trade-btn"
                  type="button"
                  onClick={() => declineTrade(receiver.id)}
                  className="flex-1 rounded-xl border px-4 py-2.5 font-bold opacity-70 hover:opacity-100"
                  style={{ borderColor: "var(--glass-border)" }}
                >
                  ❌ Decline
                </button>
                {actingAsReceiver && (
                  <button
                    type="button"
                    onClick={() => setActingAsReceiver(false)}
                    className="mt-2 w-full rounded-md border px-3 py-1 text-sm opacity-70"
                  >
                    Cancel response mode
                  </button>
                )}
              </div>
            ) : (
              // If not the sender and not yet acting as receiver, offer a toggle to respond as the receiver
              !pendingAsSender && isPending && offer && offer.receiverId !== currentPlayer.id && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setActingAsReceiver(true)}
                    className="rounded-md bg-emerald-600 px-3 py-1 text-sm font-semibold text-white"
                  >
                    Respond as {receiver.name}
                  </button>
                </div>
              )
            )}
            {pendingAsSender && (
              <p className="mt-4 rounded-xl bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-300">
                ⏳ Waiting for {receiver.name} to respond…
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
  const propName = (id: string) => squares.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {/* Sender gives */}
      <div className="rounded-2xl border border-blue-400/30 bg-blue-500/10 p-4">
        <p className="mb-2 text-xs font-black uppercase tracking-widest text-blue-300">
          🎩 {sender.name} gives
        </p>
        <p className="text-2xl font-black text-white">
          ${offer.moneyOfferedBySender.toLocaleString()}
        </p>
        {offer.propertiesOfferedBySender.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {offer.propertiesOfferedBySender.map((id) => (
              <li key={id} className="text-xs text-blue-200">
                • {propName(id)}
              </li>
            ))}
          </ul>
        )}
        {offer.moneyOfferedBySender === 0 && offer.propertiesOfferedBySender.length === 0 && (
          <p className="mt-1 text-xs opacity-40">Nothing offered</p>
        )}
      </div>

      {/* Receiver gives */}
      <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
        <p className="mb-2 text-xs font-black uppercase tracking-widest text-amber-300">
          🚗 {receiver.name} gives
        </p>
        <p className="text-2xl font-black text-white">
          ${offer.moneyOfferedByReceiver.toLocaleString()}
        </p>
        {offer.propertiesOfferedByReceiver.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {offer.propertiesOfferedByReceiver.map((id) => (
              <li key={id} className="text-xs text-amber-200">
                • {propName(id)}
              </li>
            ))}
          </ul>
        )}
        {offer.moneyOfferedByReceiver === 0 && offer.propertiesOfferedByReceiver.length === 0 && (
          <p className="mt-1 text-xs opacity-40">Nothing offered</p>
        )}
      </div>
    </div>
  );
}
