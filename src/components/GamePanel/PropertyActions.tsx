import { useGameStore } from "../../store/gameStore";

export function PropertyActions() {
  const pendingAction = useGameStore((s) => s.pendingAction);
  const squares = useGameStore((s) => s.squares);
  const buyProperty = useGameStore((s) => s.buyProperty);
  const declineBuy = useGameStore((s) => s.declineBuy);

  if (!pendingAction || pendingAction.type !== "buy") return null;

  const square = squares.find((s) => s.id === pendingAction.propertyId);
  if (!square) return null;

  return (
    <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 backdrop-blur-sm">
      <p className="text-sm font-medium">
        {square.name} — ${square.price} (base rent $
        {square.rent?.base ?? "—"})
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={buyProperty}
          className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-500"
        >
          Buy
        </button>
        <button
          type="button"
          onClick={declineBuy}
          className="flex-1 rounded-xl border px-3 py-2 text-sm font-semibold hover:opacity-80"
          style={{ borderColor: "var(--glass-border)" }}
        >
          Pass
        </button>
      </div>
    </div>
  );
}
