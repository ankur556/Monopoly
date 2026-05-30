import { calculateRent } from "../../lib/rent";
import { COLOR_GROUP_MEMBERS } from "../../data/boardDefinitions";
import type { BoardSquare } from "../../types/game";

/** Maps color group names to their physical card header background colors */
const DEED_HEADER_COLORS: Record<string, string> = {
  brown: "#8B4513",
  "light-blue": "#87CEEB",
  pink: "#FF69B4",
  orange: "#FF8C00",
  red: "#DC143C",
  yellow: "#FFD700",
  green: "#228B22",
  "dark-blue": "#00008B",
  railroad: "#2F2F2F",
  utility: "#888888",
};

/** Returns whether the color needs dark text (light backgrounds) */
function needsDarkText(color: string): boolean {
  return ["light-blue", "yellow", "utility"].includes(color);
}

interface TitleDeedCardProps {
  square: BoardSquare;
  ownerName?: string;
  /** All board squares — needed to compute accurate current rent */
  squares?: BoardSquare[];
  /** Last dice roll — needed for utility rent calculation */
  lastDiceRoll?: number;
}

/**
 * A physical-style Monopoly Title Deed card.
 * Shows: colored header, price, current active rent, full rent schedule
 * with the active tier highlighted, mortgage value, and house cost.
 */
export function TitleDeedCard({
  square,
  ownerName,
  squares = [],
  lastDiceRoll = 7,
}: TitleDeedCardProps) {
  const colorKey = square.colorGroup ?? "utility";
  const headerBg = DEED_HEADER_COLORS[colorKey] ?? "#888888";
  const darkText = needsDarkText(colorKey);
  const rent = square.rent;

  const isRailroad = square.type === "railroad";
  const isUtility = square.type === "utility";
  const isProperty = square.type === "property";

  const mortgageValue = square.price ? Math.floor(square.price / 2) : null;

  // Compute the current rent that would be charged if someone lands now
  const groupIds = square.colorGroup
    ? (COLOR_GROUP_MEMBERS[square.colorGroup] ?? [])
    : [];
  const currentRent = square.ownerId && squares.length > 0
    ? calculateRent(square, squares, lastDiceRoll, groupIds)
    : null;

  // Which rent row is "active" right now?
  function isActiveRow(tier: "base" | "one" | "two" | "three" | "four" | "hotel"): boolean {
    if (!square.ownerId) return false;
    const h = square.houses;
    if (tier === "hotel") return h >= 5;
    if (tier === "four") return h === 4;
    if (tier === "three") return h === 3;
    if (tier === "two") return h === 2;
    if (tier === "one") return h === 1;
    return h === 0; // base
  }

  return (
    <div className="deed-card animate-deed-reveal w-full max-w-[260px]">
      {/* Colored header band */}
      <div
        className="deed-card-header text-center"
        style={{ backgroundColor: headerBg }}
      >
        <p
          className="text-[9px] font-bold uppercase tracking-[0.18em]"
          style={{ color: darkText ? "#1a1a1a" : "rgba(255,255,255,0.9)" }}
        >
          {isRailroad
            ? "RAILROAD"
            : isUtility
              ? "UTILITY"
              : "TITLE DEED"}
        </p>
        <h3
          className="mt-0.5 text-sm font-black uppercase leading-tight tracking-wide"
          style={{ color: darkText ? "#1a1a1a" : "#ffffff" }}
        >
          {square.name}
        </h3>
      </div>

      {/* Inner card content */}
      <div className="p-3">
        {/* Price row */}
        <div className="mb-2 flex justify-between border-b-2 border-black pb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide">
            Price
          </span>
          <span className="text-[11px] font-black">${square.price ?? "—"}</span>
        </div>

        {/* Owner badge */}
        {ownerName && (
          <div className="mb-2 rounded bg-black/8 px-2 py-1 text-center">
            <span className="text-[10px] font-semibold text-black/70">
              Owned by {ownerName}
            </span>
          </div>
        )}

        {/* ── Current Rent Banner ── */}
        {currentRent !== null && square.ownerId && (
          <div
            className="mb-2 rounded-md px-2 py-1.5 text-center"
            style={{ backgroundColor: headerBg, opacity: 0.9 }}
          >
            <p
              className="text-[8px] font-bold uppercase tracking-widest"
              style={{ color: darkText ? "#1a1a1a" : "rgba(255,255,255,0.8)" }}
            >
              Current Rent to Charge
            </p>
            <p
              className="text-base font-black"
              style={{ color: darkText ? "#1a1a1a" : "#ffffff" }}
            >
              ${currentRent.toLocaleString()}
            </p>
          </div>
        )}

        {/* Rent table — properties */}
        {isProperty && rent && (
          <div className="mb-1">
            <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-black/50">
              Rent Schedule
            </p>

            {(
              [
                { label: "Rent (no houses)", tier: "base" as const, value: rent.base },
                { label: "With 1 House", tier: "one" as const, value: rent.oneHouse },
                { label: "With 2 Houses", tier: "two" as const, value: rent.twoHouses },
                { label: "With 3 Houses", tier: "three" as const, value: rent.threeHouses },
                { label: "With 4 Houses", tier: "four" as const, value: rent.fourHouses },
                { label: "🏨 With Hotel", tier: "hotel" as const, value: rent.hotel },
              ] as const
            ).map(({ label, tier, value }) => {
              const active = isActiveRow(tier);
              return (
                <div
                  key={tier}
                  className={`deed-card-rent-row transition ${
                    active
                      ? "rounded font-black"
                      : tier === "hotel"
                        ? "font-semibold text-red-800"
                        : ""
                  }`}
                  style={
                    active
                      ? { backgroundColor: headerBg, color: darkText ? "#1a1a1a" : "#ffffff" }
                      : undefined
                  }
                >
                  <span>{label}</span>
                  <span className="font-bold">${value}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Railroad rent info */}
        {isRailroad && (
          <div className="mb-1">
            <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-black/50">
              Rent
            </p>
            {[
              ["1 Railroad owned", "$25"],
              ["2 Railroads owned", "$50"],
              ["3 Railroads owned", "$100"],
              ["4 Railroads owned", "$200"],
            ].map(([label, amt]) => (
              <div key={label} className="deed-card-rent-row">
                <span>{label}</span>
                <span className="font-bold">{amt}</span>
              </div>
            ))}
          </div>
        )}

        {/* Utility rent info */}
        {isUtility && (
          <div className="mb-1">
            <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-black/50">
              Rent
            </p>
            <div className="deed-card-rent-row">
              <span>1 Utility owned</span>
              <span className="font-bold">4× dice</span>
            </div>
            <div className="deed-card-rent-row">
              <span>Both utilities</span>
              <span className="font-bold">10× dice</span>
            </div>
          </div>
        )}

        {/* House cost + Mortgage footer */}
        <div className="mt-2 border-t-2 border-black pt-1.5 space-y-0.5">
          {isProperty && square.houseCost && square.houseCost > 0 && (
            <>
              <div className="flex justify-between text-[10px]">
                <span className="font-semibold">🏠 Houses / 🏨 Hotel</span>
                <span className="font-black">${square.houseCost} each</span>
              </div>
            </>
          )}
          {mortgageValue !== null && (
            <div className="flex justify-between text-[10px]">
              <span className="font-semibold text-black/60">Mortgage Value</span>
              <span className="font-black text-black/60">${mortgageValue}</span>
            </div>
          )}
        </div>

        {/* Current houses indicator */}
        {square.houses > 0 && (
          <div
            className="mt-2 rounded-sm py-1 text-center text-[10px] font-black uppercase tracking-wide"
            style={{ backgroundColor: headerBg, color: darkText ? "#1a1a1a" : "#ffffff" }}
          >
            {square.houses >= 5
              ? "🏨 HOTEL"
              : `${"🏠".repeat(square.houses)} ${square.houses} HOUSE${square.houses > 1 ? "S" : ""}`}
          </div>
        )}
      </div>
    </div>
  );
}
