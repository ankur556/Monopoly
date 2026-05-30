import type { BoardSquare } from "../../types/game";

/** Hex colour for each Monopoly color group */
const COLOR_DOT_HEX: Record<string, string> = {
  brown: "#8B4513",
  "light-blue": "#87CEEB",
  pink: "#FF69B4",
  orange: "#FF8C00",
  red: "#DC143C",
  yellow: "#FFD700",
  green: "#228B22",
  "dark-blue": "#00008B",
  railroad: "#3f3f46",  // zinc-700
  utility: "#9ca3af",   // gray-400
};

/** Small coloured circle for a property's group */
function ColorDot({ square }: { square: BoardSquare }) {
  if (!square.colorGroup) return null;
  const hex = COLOR_DOT_HEX[square.colorGroup];
  if (!hex) return null;
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black/20 shadow-sm"
      style={{ backgroundColor: hex }}
      title={square.colorGroup}
    />
  );
}

interface TradePropertyListProps {
  title: string;
  properties: BoardSquare[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function TradePropertyList({
  title,
  properties,
  selectedIds,
  onChange,
  disabled = false,
}: TradePropertyListProps) {
  if (properties.length === 0) {
    return (
      <div>
        <p className="mb-2 text-sm font-semibold">{title}</p>
        <p className="text-xs opacity-60">No properties available</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <ul className="max-h-36 space-y-1 overflow-y-auto">
        {properties.map((prop) => {
          const checked = selectedIds.includes(prop.id);
          return (
            <li key={prop.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/10">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => {
                    if (disabled) return;
                    onChange(
                      checked
                        ? selectedIds.filter((id) => id !== prop.id)
                        : [...selectedIds, prop.id],
                    );
                  }}
                  className="rounded"
                />
                {/* Color group dot */}
                <ColorDot square={prop} />
                <span className="flex-1 truncate">{prop.name}</span>
                <span className="text-xs opacity-60">${prop.price}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
