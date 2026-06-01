import { useGameStore } from "../../store/gameStore";

const PLAYER_COLORS: Record<string, { bg: string; ring: string; text: string; glow: string }> = {
  p1: { bg: "#3b82f6", ring: "#93c5fd", text: "#dbeafe", glow: "rgba(59,130,246,0.4)" },
  p2: { bg: "#ef4444", ring: "#fca5a5", text: "#fee2e2", glow: "rgba(239,68,68,0.4)" },
  p3: { bg: "#10b981", ring: "#6ee7b7", text: "#d1fae5", glow: "rgba(16,185,129,0.4)" },
  p4: { bg: "#f59e0b", ring: "#fcd34d", text: "#fef3c7", glow: "rgba(245,158,11,0.4)" },
  p5: { bg: "#8b5cf6", ring: "#c4b5fd", text: "#ede9fe", glow: "rgba(139,92,246,0.4)" },
  p6: { bg: "#ec4899", ring: "#f9a8d4", text: "#fce7f3", glow: "rgba(236,72,153,0.4)" },
};

const PLACE_LABELS = ["🥇 1st", "🥈 2nd", "🥉 3rd", "4th", "5th", "6th"];
const PLACE_STYLES = [
  "text-yellow-300 drop-shadow-[0_0_12px_rgba(253,224,71,0.8)]",
  "text-zinc-200",
  "text-amber-600",
  "text-zinc-400",
  "text-zinc-400",
  "text-zinc-400",
];

export function GameOverScreen() {
  const players = useGameStore((s) => s.players);
  const winnerId = useGameStore((s) => s.winnerId);
  const eliminationOrder = useGameStore((s) => s.eliminationOrder);
  const returnToMenu = useGameStore((s) => s.returnToMenu);
  const initLocalGame = useGameStore((s) => s.initLocalGame);

  if (!winnerId) return null;

  // Build final standings: winner first, then eliminated in reverse order (last eliminated = 2nd)
  const winner = players.find((p) => p.id === winnerId)!;
  const eliminated = [...eliminationOrder]
    .reverse()
    .map((id) => players.find((p) => p.id === id)!)
    .filter(Boolean);
  const standings = [winner, ...eliminated];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(12px)" }}
    >
      {/* Confetti-like star decorations */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[...Array(18)].map((_, i) => (
          <span
            key={i}
            className="absolute animate-pulse text-xl opacity-20"
            style={{
              left: `${(i * 17 + 5) % 100}%`,
              top: `${(i * 23 + 8) % 100}%`,
              animationDelay: `${(i * 0.3) % 2}s`,
              animationDuration: `${1.5 + (i % 3) * 0.5}s`,
            }}
          >
            {["⭐", "✨", "🎉", "🎊"][i % 4]}
          </span>
        ))}
      </div>

      <div className="relative flex w-full max-w-lg flex-col items-center gap-6 px-4 py-8">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-5xl font-black tracking-tight text-white drop-shadow-[0_0_24px_rgba(255,255,255,0.3)]">
            GAME OVER
          </h1>
          <p className="mt-1 text-lg font-semibold text-yellow-300">
            🏆 {winner.name} wins the game!
          </p>
        </div>

        {/* Standings card */}
        <div
          className="w-full overflow-hidden rounded-2xl border shadow-2xl"
          style={{
            background: "rgba(255,255,255,0.06)",
            borderColor: "rgba(255,255,255,0.12)",
          }}
        >
          <div className="border-b border-white/10 px-5 py-3">
            <p className="text-xs font-black uppercase tracking-widest text-white/50">
              Final Standings
            </p>
          </div>

          <div className="flex flex-col divide-y divide-white/10">
            {standings.map((player, idx) => {
              const colors = PLAYER_COLORS[player.id] ?? PLAYER_COLORS.p1;
              const isWinner = idx === 0;

              return (
                <div
                  key={player.id}
                  className="flex items-center gap-4 px-5 py-3.5 transition"
                  style={
                    isWinner
                      ? {
                          background: `linear-gradient(90deg, ${colors.glow} 0%, transparent 100%)`,
                        }
                      : undefined
                  }
                >
                  {/* Place */}
                  <span
                    className={`w-12 shrink-0 text-center text-sm font-black ${PLACE_STYLES[idx] ?? PLACE_STYLES[3]}`}
                  >
                    {PLACE_LABELS[idx] ?? `${idx + 1}th`}
                  </span>

                  {/* Avatar */}
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white shadow-lg"
                    style={{
                      backgroundColor: colors.bg,
                      boxShadow: isWinner ? `0 0 16px ${colors.glow}` : undefined,
                    }}
                  >
                    {player.name[0]?.toUpperCase() ?? "?"}
                  </div>

                  {/* Name + balance */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-white">{player.name}</p>
                    <p className="text-xs text-white/50">
                      {idx === 0
                        ? `$${player.balance.toLocaleString()} remaining`
                        : player.balance > 0
                          ? `$${player.balance.toLocaleString()} remaining`
                          : "Bankrupt"}
                    </p>
                  </div>

                  {/* Trophy for winner */}
                  {isWinner && (
                    <span className="shrink-0 text-2xl">🏆</span>
                  )}
                  {!isWinner && idx === 1 && (
                    <span className="shrink-0 text-xl">🥈</span>
                  )}
                  {!isWinner && idx === 2 && (
                    <span className="shrink-0 text-xl">🥉</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex w-full flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => initLocalGame(players.map((p) => ({ name: p.name, isBot: p.isBot ?? false })))}
            className="flex-1 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-400 active:scale-95"
          >
            🔄 Rematch
          </button>
          <button
            type="button"
            onClick={returnToMenu}
            className="flex-1 rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-white/20 active:scale-95"
          >
            🏠 Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
