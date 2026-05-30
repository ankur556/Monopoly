import { useState } from "react";
import { useGameStore } from "../../store/gameStore";

const PLAYER_COLORS = [
  { border: "border-blue-400", ring: "ring-blue-400", bg: "bg-blue-600", label: "text-blue-300" },
  { border: "border-red-400", ring: "ring-red-400", bg: "bg-red-600", label: "text-red-300" },
  { border: "border-emerald-400", ring: "ring-emerald-400", bg: "bg-emerald-600", label: "text-emerald-300" },
  { border: "border-amber-400", ring: "ring-amber-400", bg: "bg-amber-600", label: "text-amber-300" },
  { border: "border-purple-400", ring: "ring-purple-400", bg: "bg-purple-600", label: "text-purple-300" },
  { border: "border-pink-400", ring: "ring-pink-400", bg: "bg-pink-600", label: "text-pink-300" },
];

const TOKEN_ICONS = ["🎩", "🚗", "🏠", "🐶", "⛵", "🎸"];

type MenuStep = "HOME" | "SETUP";

export function StartMenu() {
  const initLocalGame = useGameStore((s) => s.initLocalGame);

  const [step, setStep] = useState<MenuStep>("HOME");
  const [playerCount, setPlayerCount] = useState(2);
  const [names, setNames] = useState<string[]>(
    Array.from({ length: 6 }, (_, i) => `Player ${i + 1}`),
  );
  const [comingSoonVisible, setComingSoonVisible] = useState(false);

  function updateName(index: number, value: string) {
    setNames((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function handleStartGame() {
    initLocalGame(names.slice(0, playerCount));
  }

  function handleOnlineClick() {
    setComingSoonVisible(true);
    setTimeout(() => setComingSoonVisible(false), 3000);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-gradient-to-br from-zinc-950 via-indigo-950 to-zinc-900 p-4">

      {/* Decorative background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-700/20 blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-purple-700/20 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/10 blur-3xl" />
      </div>

      {/* Coming Soon toast */}
      <div
        className={`pointer-events-none fixed top-6 left-1/2 -translate-x-1/2 z-[60] transition-all duration-500 ${
          comingSoonVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
        }`}
      >
        <div className="rounded-2xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-xl shadow-2xl">
          🚧 Online play coming soon!
        </div>
      </div>

      {step === "HOME" && (
        <div className="relative flex flex-col items-center gap-8 text-white">
          {/* Logo */}
          <div className="text-center">
            <h1 className="text-8xl font-black uppercase tracking-[0.12em] drop-shadow-2xl sm:text-9xl"
              style={{
                background: "linear-gradient(135deg, #fde68a 0%, #f59e0b 40%, #d97706 70%, #fde68a 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              MONOPOLY
            </h1>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.3em] text-white/40">
              The Classic Board Game
            </p>
          </div>

          {/* Token row decorative */}
          <div className="flex gap-4 text-4xl">
            {TOKEN_ICONS.map((icon, i) => (
              <span
                key={i}
                className="animate-bounce"
                style={{ animationDelay: `${i * 0.12}s`, animationDuration: "1.8s" }}
              >
                {icon}
              </span>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex w-full max-w-sm flex-col gap-3">
            <button
              id="local-multiplayer-btn"
              type="button"
              onClick={() => setStep("SETUP")}
              className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 py-4 text-lg font-black uppercase tracking-widest text-white shadow-2xl transition hover:scale-[1.02] hover:from-amber-400 hover:to-amber-500 active:scale-95"
            >
              <span className="relative z-10">🎮 Local Multiplayer</span>
              <div className="absolute inset-0 bg-white/10 opacity-0 transition group-hover:opacity-100" />
            </button>

            <button
              id="online-room-code-btn"
              type="button"
              onClick={handleOnlineClick}
              className="group relative w-full overflow-hidden rounded-2xl border border-white/20 bg-white/5 py-4 text-lg font-bold uppercase tracking-widest text-white/50 shadow-xl backdrop-blur-sm transition hover:border-white/30 hover:bg-white/10 hover:text-white/70"
            >
              <span className="relative z-10">🌐 Play Online via Room Code</span>
              <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-black tracking-wider">
                SOON
              </span>
            </button>
          </div>
        </div>
      )}

      {step === "SETUP" && (
        <div className="relative w-full max-w-xl text-white">
          {/* Back button */}
          <button
            type="button"
            onClick={() => setStep("HOME")}
            className="mb-6 flex items-center gap-2 text-sm font-semibold text-white/50 transition hover:text-white"
          >
            ← Back
          </button>

          <h2 className="mb-1 text-3xl font-black uppercase tracking-wider text-white">
            Player Setup
          </h2>
          <p className="mb-6 text-sm text-white/40">
            Configure your local game
          </p>

          {/* Player count selector */}
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-white/50">
              Number of Players
            </p>
            <div className="flex gap-2">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  id={`player-count-${n}`}
                  type="button"
                  onClick={() => setPlayerCount(n)}
                  className={`flex-1 rounded-xl py-3 text-lg font-black transition ${
                    playerCount === n
                      ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30 scale-105"
                      : "bg-white/10 text-white/60 hover:bg-white/15 hover:text-white"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Player name inputs */}
          <div className="mb-6 flex flex-col gap-3">
            {Array.from({ length: playerCount }).map((_, i) => {
              const color = PLAYER_COLORS[i];
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-2xl border ${color.border} bg-white/5 px-4 py-3 backdrop-blur-sm transition focus-within:ring-2 ${color.ring} focus-within:ring-offset-1 focus-within:ring-offset-transparent`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${color.bg} text-xl shadow-lg`}>
                    {TOKEN_ICONS[i]}
                  </div>
                  <div className="flex-1">
                    <label className={`block text-[9px] font-black uppercase tracking-widest ${color.label} mb-0.5`}>
                      Player {i + 1}
                    </label>
                    <input
                      id={`player-name-${i + 1}`}
                      type="text"
                      maxLength={20}
                      value={names[i]}
                      onChange={(e) => updateName(i, e.target.value)}
                      placeholder={`Player ${i + 1}`}
                      className="w-full bg-transparent text-sm font-semibold text-white placeholder:text-white/25 focus:outline-none"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Start Game button */}
          <button
            id="start-game-btn"
            type="button"
            onClick={handleStartGame}
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-5 text-xl font-black uppercase tracking-widest text-white shadow-2xl shadow-emerald-500/30 transition hover:scale-[1.02] hover:from-emerald-400 hover:to-emerald-500 active:scale-95"
          >
            🚀 Start Game
          </button>

          <p className="mt-3 text-center text-xs text-white/30">
            {playerCount} player{playerCount > 1 ? "s" : ""} · Local multiplayer · $1500 starting balance
          </p>
        </div>
      )}
    </div>
  );
}
