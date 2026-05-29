import { useState } from "react";
import { useGameStore } from "../../store/gameStore";
import { GlassPanel } from "../ui/GlassPanel";

const PLAYER_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  p1: { bg: "bg-blue-600", text: "text-blue-200", icon: "🎩" },
  p2: { bg: "bg-red-600", text: "text-red-200", icon: "🚗" },
};

const QUICK_BIDS = [10, 25, 50, 100];

/**
 * Public auction modal — shown when a player declines to buy a property.
 * Players alternate bidding until all but one have passed.
 * The last bidder wins the property at their highest bid price.
 */
export function AuctionModal() {
  const auction = useGameStore((s) => s.auction);
  const players = useGameStore((s) => s.players);
  const squares = useGameStore((s) => s.squares);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const placeBid = useGameStore((s) => s.placeBid);
  const passAuction = useGameStore((s) => s.passAuction);

  const [bidInput, setBidInput] = useState("");
  const [error, setError] = useState("");

  if (auction.status !== "active") return null;

  const square = squares.find((s) => s.id === auction.propertyId);
  if (!square) return null;

  const currentBidder = players[auction.currentBidderIndex];
  const currentPlayer = players[currentPlayerIndex];
  const isMyTurn = currentBidder.id === currentPlayer.id;

  const highestBid = Math.max(...Object.values(auction.bids));
  const minBid = highestBid + 1;

  const activePlayers = players.filter(
    (p) => !auction.passedPlayerIds.includes(p.id),
  );

  function handleBid(amount: number) {
    setError("");
    if (amount <= highestBid) {
      setError(`Must bid more than the current high of $${highestBid}`);
      return;
    }
    if (amount > currentBidder.balance) {
      setError(`${currentBidder.name} can't afford $${amount}`);
      return;
    }
    placeBid(amount);
    setBidInput("");
  }

  function handleCustomBid() {
    const amount = parseInt(bidInput, 10);
    if (isNaN(amount) || amount <= 0) {
      setError("Enter a valid bid amount");
      return;
    }
    handleBid(amount);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <GlassPanel className="w-full max-w-lg p-6">

        {/* Header */}
        <div className="mb-5 text-center">
          <div className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-3xl shadow-xl">
            🔨
          </div>
          <h2 className="text-2xl font-black uppercase tracking-widest text-amber-400">
            Public Auction
          </h2>
          <p className="mt-1 text-sm opacity-60">
            {square.name} — starting at $1
          </p>
        </div>

        {/* Property info strip */}
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Property on the block
            </p>
            <p className="text-lg font-black text-white">{square.name}</p>
            <p className="text-xs text-amber-200/60">
              Market value: ${square.price ?? "—"}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
              Current high bid
            </p>
            <p className="text-3xl font-black text-white">
              ${highestBid === 0 ? "—" : highestBid.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Player bid status */}
        <div className="mb-5 grid grid-cols-2 gap-3">
          {players.map((player) => {
            const colors = PLAYER_COLORS[player.id] ?? { bg: "bg-zinc-600", text: "text-zinc-200", icon: "🎲" };
            const passed = auction.passedPlayerIds.includes(player.id);
            const isBidding = currentBidder.id === player.id;
            const myBid = auction.bids[player.id] ?? 0;

            return (
              <div
                key={player.id}
                className={`rounded-xl border p-3 transition ${
                  passed
                    ? "border-white/10 bg-white/5 opacity-40"
                    : isBidding
                      ? `border-amber-400/60 bg-amber-500/15 ring-1 ring-amber-400`
                      : "border-white/15 bg-white/8"
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${colors.bg}`}
                  >
                    {colors.icon}
                  </span>
                  <span className="text-sm font-bold">{player.name}</span>
                  {isBidding && !passed && (
                    <span className="ml-auto rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-black text-amber-900 uppercase">
                      Your turn
                    </span>
                  )}
                  {passed && (
                    <span className="ml-auto text-[9px] font-semibold uppercase text-red-400">
                      Passed
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/50">
                  Balance: ${player.balance.toLocaleString()}
                </p>
                <p className={`text-sm font-black ${myBid > 0 ? colors.text : "text-white/30"}`}>
                  {myBid > 0 ? `Bid: $${myBid.toLocaleString()}` : "No bid yet"}
                </p>
              </div>
            );
          })}
        </div>

        {/* Active bidders indicator */}
        <p className="mb-3 text-center text-xs text-white/50">
          {activePlayers.length} player{activePlayers.length !== 1 ? "s" : ""} remaining ·{" "}
          {isMyTurn ? (
            <span className="font-bold text-amber-300">It's YOUR turn to bid</span>
          ) : (
            <span>Waiting for {currentBidder.name}…</span>
          )}
        </p>

        {/* Bidding controls — only shown to the current bidder */}
        {isMyTurn && (
          <div className="space-y-3">
            {/* Quick bid buttons */}
            <div className="grid grid-cols-4 gap-2">
              {QUICK_BIDS.map((increment) => {
                const quickAmt = highestBid + increment;
                const canAfford = quickAmt <= currentBidder.balance;
                return (
                  <button
                    key={increment}
                    id={`quick-bid-${increment}`}
                    type="button"
                    disabled={!canAfford}
                    onClick={() => handleBid(quickAmt)}
                    className="rounded-xl bg-amber-600/80 px-2 py-2 text-xs font-black text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ${quickAmt.toLocaleString()}
                    <span className="block text-[9px] font-normal opacity-70">
                      +${increment}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Custom bid input */}
            <div className="flex gap-2">
              <input
                id="custom-bid-input"
                type="number"
                min={minBid}
                max={currentBidder.balance}
                value={bidInput}
                onChange={(e) => {
                  setBidInput(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleCustomBid()}
                placeholder={`Custom bid (min $${minBid})`}
                className="flex-1 rounded-xl border border-amber-400/30 bg-amber-900/20 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <button
                id="place-bid-btn"
                type="button"
                onClick={handleCustomBid}
                className="rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 px-4 py-2 font-bold text-white shadow-lg transition hover:from-amber-400 hover:to-amber-600 active:scale-95"
              >
                Bid
              </button>
            </div>

            {/* Error message */}
            {error && (
              <p className="rounded-lg bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-300">
                ⚠ {error}
              </p>
            )}

            {/* Pass button */}
            <button
              id="pass-auction-btn"
              type="button"
              onClick={() => {
                setError("");
                passAuction();
              }}
              className="w-full rounded-xl border border-white/20 py-2.5 text-sm font-semibold text-white/60 transition hover:border-red-400/40 hover:text-red-300"
            >
              🚫 Pass (withdraw from auction)
            </button>
          </div>
        )}

        {/* Waiting state for non-current-bidder */}
        {!isMyTurn && (
          <div className="rounded-xl bg-white/5 px-4 py-3 text-center text-sm text-white/50">
            ⏳ Waiting for {currentBidder.name} to bid or pass…
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
