import { useGameStore } from "../../store/gameStore";

export function LedgerPanel() {
  const ledger = useGameStore((s) => s.ledger);
  const recent = ledger.slice(-5).reverse();

  if (recent.length === 0) return null;

  return (
    <div
      className="rounded-xl border p-3"
      style={{
        backgroundColor: "var(--glass-bg)",
        borderColor: "var(--glass-border)",
      }}
    >
      <p className="mb-2 text-xs font-bold uppercase tracking-wider opacity-70">
        Economic Ledger
      </p>
      <ul className="max-h-28 space-y-1 overflow-y-auto text-xs opacity-90">
        {recent.map((entry) => (
          <li key={entry.id} className="border-b border-white/10 pb-1">
            {entry.message}
            {entry.amount > 0 && (
              <span className="ml-1 font-medium">${entry.amount}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
