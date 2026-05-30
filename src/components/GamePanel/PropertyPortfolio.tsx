import { getBuildableSquares, getGroupMemberIds, getSellableSquares } from "../../lib/building";
import { RAILROAD_RENTS, COLOR_GROUP_MEMBERS } from "../../data/boardDefinitions";
import { ownsColorSet } from "../../lib/rent";
import { useGameStore } from "../../store/gameStore";
import type { BoardSquare } from "../../types/game";

/** Maps color group to a Tailwind color for the group chip */
const GROUP_CHIP_STYLE: Record<string, { bg: string; text: string }> = {
  brown: { bg: "bg-[#8B4513]", text: "text-white" },
  "light-blue": { bg: "bg-[#87CEEB]", text: "text-zinc-900" },
  pink: { bg: "bg-[#FF69B4]", text: "text-white" },
  orange: { bg: "bg-[#FF8C00]", text: "text-white" },
  red: { bg: "bg-[#DC143C]", text: "text-white" },
  yellow: { bg: "bg-[#FFD700]", text: "text-zinc-900" },
  green: { bg: "bg-[#228B22]", text: "text-white" },
  "dark-blue": { bg: "bg-[#00008B]", text: "text-white" },
  railroad: { bg: "bg-zinc-800", text: "text-white" },
  utility: { bg: "bg-zinc-400", text: "text-zinc-900" },
};

function HouseIcons({ count }: { count: number }) {
  if (count === 0) return <span className="text-[10px] text-zinc-400">No buildings</span>;
  if (count >= 5) return <span className="text-sm">🏨</span>;
  return <span className="text-sm">{"🏠".repeat(count)}</span>;
}

export function PropertyPortfolio() {
  const squares = useGameStore((s) => s.squares);
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const buildHouse = useGameStore((s) => s.buildHouse);
  const sellHouse = useGameStore((s) => s.sellHouse);
  const mortgageProperty = useGameStore((s) => s.mortgageProperty);
  const unmortgageProperty = useGameStore((s) => s.unmortgageProperty);
  const isMoving = useGameStore((s) => s.isMoving);
  const isRolling = useGameStore((s) => s.isRolling);
  const pendingAction = useGameStore((s) => s.pendingAction);

  const currentPlayer = players[currentPlayerIndex];
  const ownedSquares = squares.filter(
    (sq) =>
      sq.ownerId === currentPlayer.id &&
      (sq.type === "property" || sq.type === "railroad" || sq.type === "utility"),
  );

  if (ownedSquares.length === 0) return null;

  // Group by colorGroup or type
  const groups: Record<string, BoardSquare[]> = {};
  for (const sq of ownedSquares) {
    const key = sq.colorGroup ?? sq.type;
    if (!groups[key]) groups[key] = [];
    groups[key].push(sq);
  }

  const buildable = new Set(getBuildableSquares(squares, currentPlayer.id).map((s) => s.id));
  const sellable = new Set(getSellableSquares(squares, currentPlayer.id).map((s) => s.id));
  const blocked = isMoving || isRolling || !!pendingAction;

  return (
    <div className="rounded-xl border border-white/15 bg-black/20 p-3 backdrop-blur-sm">
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-emerald-300/80">
        📋 My Portfolio — {currentPlayer.name}
      </p>

      {/* Color Set Inventory */}
      <div className="mb-3">
        <div className="flex gap-3 flex-wrap items-center">
          {Object.entries(COLOR_GROUP_MEMBERS).map(([cg, ids]) => {
            const owned = ids.reduce((acc, id) => {
              const sq = squares.find((s) => s.id === id);
              return acc + (sq && sq.ownerId === currentPlayer.id ? 1 : 0);
            }, 0);
            const total = ids.length;
            const chip = GROUP_CHIP_STYLE[cg] ?? { bg: "bg-zinc-600", text: "text-white" };
            const full = owned === total && total > 0;
            return (
              <div key={cg} className="flex flex-col items-center text-[11px]">
                <div className={`w-8 h-5 rounded-sm ${chip.bg} ${chip.text} ${full ? 'ring-4 ring-current shadow-[0_0_15px_inherit]' : ''}`} />
                <div className="mt-1 text-[10px] text-zinc-300">{owned}/{total}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="max-h-[600px] overflow-y-auto pr-2">
        <div className="flex flex-col gap-3">
          {Object.entries(groups).map(([group, props]) => {
            const chip = GROUP_CHIP_STYLE[group] ?? { bg: "bg-zinc-600", text: "text-white" };
            const label = group.replace("-", " ").toUpperCase();
            const groupIds = props[0].colorGroup ? getGroupMemberIds(props[0].colorGroup) : [];
            const ownsFullSet = props[0].colorGroup ? ownsColorSet(squares, currentPlayer.id, props[0].colorGroup!, groupIds) : false;

            return (
              <div key={group} className="animate-portfolio-slide">
                <div className={`mb-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${chip.bg} ${chip.text}`}>
                  {label}
                  {ownsFullSet && !blocked && (
                    <span className="rounded-full bg-white/25 px-1 py-px text-[8px]">FULL SET</span>
                  )}
                </div>

                <div className="grid gap-2">
                  {props.map((sq) => {
                    const isBuildable = buildable.has(sq.id) && !blocked;
                    const isSellable = sellable.has(sq.id) && !blocked;
                    const groupIdsLocal = sq.colorGroup ? getGroupMemberIds(sq.colorGroup) : [];
                    const hasFullSet = sq.colorGroup ? ownsColorSet(squares, currentPlayer.id, sq.colorGroup, groupIdsLocal) : false;
                    const sellPrice = sq.houseCost ? Math.floor(sq.houseCost / 2) : 0;
                    const mortgageValue = sq.price ? Math.floor(sq.price / 2) : 0;
                    const unmortgageCost = Math.ceil(mortgageValue * 1.1);
                    const setHasHouses = props.some((p) => p.houses > 0);

                    return (
                      <div key={sq.id} className="rounded-lg bg-white/6 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-sm ${GROUP_CHIP_STYLE[sq.colorGroup ?? sq.type]?.bg ?? 'bg-zinc-600'}`} />
                              <div className="min-w-0">
                                <div className="truncate font-bold text-sm">{sq.name}</div>
                                <div className="text-[11px] text-zinc-400">Price: ${sq.price ?? "—"}</div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="text-sm mr-2"><HouseIcons count={sq.houses} /></div>

                            {hasFullSet && (
                              <div className="flex items-center gap-2">
                                <button
                                  disabled={!isBuildable}
                                  onClick={() => buildHouse(sq.id)}
                                  className={`rounded-lg px-3 py-1 text-sm font-black ${isBuildable ? 'bg-emerald-500 text-white' : 'bg-white/6 text-white/50'}`}>
                                  + ${sq.houseCost}
                                </button>
                                <button
                                  disabled={!isSellable}
                                  onClick={() => sellHouse(sq.id)}
                                  className={`rounded-lg px-3 py-1 text-sm font-black ${isSellable ? 'bg-rose-500 text-white' : 'bg-white/6 text-white/50'}`}>
                                  - +${sellPrice}
                                </button>
                              </div>
                            )}

                            <div className="ml-2">
                              {sq.mortgaged ? (
                                <button
                                  onClick={() => unmortgageProperty(sq.id)}
                                  className="rounded-lg bg-red-500 hover:bg-red-600 px-2 py-1 text-xs font-semibold text-white"
                                >Unmortgage (-${unmortgageCost})</button>
                              ) : (
                                // Hide mortgage button entirely if any houses exist in the set
                                !setHasHouses && (
                                  <button
                                    onClick={() => mortgageProperty(sq.id)}
                                    className="rounded-lg bg-red-500 hover:bg-red-600 px-2 py-1 text-xs font-semibold text-white"
                                  >Mortgage (+${mortgageValue})</button>
                                )
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 text-[13px]">
                          {sq.type === 'property' && sq.rent ? (
                            <div className="grid grid-cols-1 gap-1">
                              {(() => {
                                const rows = [
                                  { key: 'base', label: 'Base Rent', value: sq.rent.base * (hasFullSet ? 2 : 1), doubled: hasFullSet },
                                  { key: '1', label: 'With 1 House', value: sq.rent.oneHouse },
                                  { key: '2', label: 'With 2 Houses', value: sq.rent.twoHouses },
                                  { key: '3', label: 'With 3 Houses', value: sq.rent.threeHouses },
                                  { key: '4', label: 'With 4 Houses', value: sq.rent.fourHouses },
                                  { key: 'hotel', label: 'With Hotel', value: sq.rent.hotel },
                                ];

                                return rows.map((r) => {
                                  const active = (sq.houses === 0 && r.key === 'base') || (sq.houses === 5 && r.key === 'hotel') || (typeof r.key === 'string' && r.key !== 'base' && r.key !== 'hotel' && Number(r.key) === sq.houses);
                                  return (
                                    <div key={r.key} className={`flex items-center justify-between px-2 py-1 rounded ${active ? 'bg-white/10 font-semibold' : 'text-zinc-300'}`}>
                                      <div className="text-[12px]">{r.label}{r.doubled ? ' (x2)' : ''}</div>
                                      <div className="text-[12px]">${r.value}</div>
                                    </div>
                                  );
                                });
                              })()}

                              <div className="mt-2 text-[12px] flex items-center justify-between text-zinc-300">
                                <div>Mortgage Value</div>
                                <div className="font-bold">${mortgageValue ?? '—'}</div>
                              </div>
                            </div>
                          ) : sq.type === 'railroad' ? (
                            <div className="grid grid-cols-1 gap-1">
                              {RAILROAD_RENTS.map((v, i) => (
                                <div key={i} className={`flex items-center justify-between px-2 py-1 rounded ${sq.type === 'railroad' && sq.houses === 0 && i === 0 ? 'bg-white/10 font-semibold' : 'text-zinc-300'}`}>
                                  <div className="text-[12px]">Own {i + 1} Railroad{(i > 0) ? 's' : ''}</div>
                                  <div className="text-[12px]">${v}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-[12px] text-zinc-300">Utility rent: 4× dice (1 utility) or 10× dice (2 utilities)</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
