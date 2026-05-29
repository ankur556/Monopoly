import type { BoardSquare } from "../../types/game";

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
