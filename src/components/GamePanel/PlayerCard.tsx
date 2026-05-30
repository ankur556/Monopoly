import type { Player } from "../../types/game";

const ACCENT: Record<string, string> = {
  p1: "ring-blue-400 shadow-blue-500/30",
  p2: "ring-red-400 shadow-red-500/30",
};

const AVATAR: Record<string, string> = {
  p1: "bg-blue-500",
  p2: "bg-red-500",
};

interface PlayerCardProps {
  player: Player;
  isCurrent: boolean;
}

export function PlayerCard({ player, isCurrent }: PlayerCardProps) {
  return (
    <div
      className={`rounded-xl border p-3 transition ${
        isCurrent
          ? `ring-2 shadow-lg ${ACCENT[player.id] ?? "ring-emerald-400"}`
          : "opacity-85"
      }`}
      style={{
        backgroundColor: "var(--glass-bg)",
        borderColor: "var(--glass-border)",
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className={`relative h-8 w-8 shrink-0 rounded-full shadow-md ring-2 ring-white/80 ${AVATAR[player.id] ?? "bg-zinc-500"}`}
        >
          {/* Jail lock overlay */}
          {player.inJail && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[8px]">
              🔒
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-semibold">{player.name}</p>
            {isCurrent && (
              <span className="shrink-0 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-400">
                ▶ Turn
              </span>
            )}
          </div>
          <p className="text-sm opacity-70">
            ${player.balance.toLocaleString()}
          </p>
          {/* Jail info */}
          {player.inJail && (
            <p className="text-[10px] font-semibold text-orange-400">
              In Jail (attempt {player.jailTurns + 1}/3)
            </p>
          )}
          {/* Doubles streak */}
          {player.doublesCount > 0 && !player.inJail && (
            <p className="text-[10px] font-semibold text-amber-400">
              🎲 {player.doublesCount} double{player.doublesCount > 1 ? "s" : ""} in a row!
            </p>
          )}
        </div>
        {/* GOOJF card badge */}
        {player.getOutOfJailFreeCards > 0 && (
          <div
            title="Get Out of Jail Free card"
            className="shrink-0 rounded-lg bg-purple-600/80 px-1.5 py-1 text-center"
          >
            <span className="block text-sm">🃏</span>
            <span className="block text-[8px] font-black text-white">
              ×{player.getOutOfJailFreeCards}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
