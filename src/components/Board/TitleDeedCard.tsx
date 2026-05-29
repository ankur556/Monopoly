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
}

/**
 * A physical-style Monopoly Title Deed card.
 * Mimics the real card: colored header, bordered rent table, house costs at bottom.
 */
export function TitleDeedCard({ square, ownerName }: TitleDeedCardProps) {
  const colorKey = square.colorGroup ?? "utility";
  const headerBg = DEED_HEADER_COLORS[colorKey] ?? "#888888";
  const darkText = needsDarkText(colorKey);
  const rent = square.rent;

  const isRailroad = square.type === "railroad";
  const isUtility = square.type === "utility";
  const isProperty = square.type === "property";

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
              : `TITLE DEED`}
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

        {/* Rent table — properties */}
        {isProperty && rent && (
          <div className="mb-1">
            <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-black/50">
              Rent Schedule
            </p>
            <div className="deed-card-rent-row">
              <span>Rent</span>
              <span className="font-bold">${rent.base}</span>
            </div>
            <div className="deed-card-rent-row">
              <span>With 1 House</span>
              <span className="font-bold">${rent.oneHouse}</span>
            </div>
            <div className="deed-card-rent-row">
              <span>With 2 Houses</span>
              <span className="font-bold">${rent.twoHouses}</span>
            </div>
            <div className="deed-card-rent-row">
              <span>With 3 Houses</span>
              <span className="font-bold">${rent.threeHouses}</span>
            </div>
            <div className="deed-card-rent-row">
              <span>With 4 Houses</span>
              <span className="font-bold">${rent.fourHouses}</span>
            </div>
            <div className="deed-card-rent-row font-semibold text-red-800">
              <span>🏨 With Hotel</span>
              <span className="font-black">${rent.hotel}</span>
            </div>
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

        {/* House cost footer */}
        {isProperty && square.houseCost && square.houseCost > 0 && (
          <div className="mt-2 border-t-2 border-black pt-1.5">
            <div className="flex justify-between text-[10px]">
              <span className="font-semibold">🏠 House</span>
              <span className="font-black">${square.houseCost}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="font-semibold">🏨 Hotel</span>
              <span className="font-black">${square.houseCost}</span>
            </div>
          </div>
        )}

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
