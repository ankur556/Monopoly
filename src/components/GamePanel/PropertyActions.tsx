import { useGameStore } from "../../store/gameStore";

export function PropertyActions() {
  const pendingAction = useGameStore((s) => s.pendingAction);
  const properties = useGameStore((s) => s.properties);
  const buyProperty = useGameStore((s) => s.buyProperty);
  const declineBuy = useGameStore((s) => s.declineBuy);

  if (!pendingAction || pendingAction.type !== "buy") return null;

  const property = properties.find((p) => p.id === pendingAction.propertyId);
  if (!property) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="text-sm font-medium text-zinc-800">
        {property.name} — ${property.price} (rent ${property.rent})
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={buyProperty}
          className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Buy
        </button>
        <button
          type="button"
          onClick={declineBuy}
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          Pass
        </button>
      </div>
    </div>
  );
}
