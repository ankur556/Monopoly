interface HouseIndicatorsProps {
  houses: number;
}

export function HouseIndicators({ houses }: HouseIndicatorsProps) {
  if (houses <= 0) return null;

  if (houses >= 5) {
    return (
      <div className="flex justify-center">
        <span
          className="h-2 w-3 rounded-sm bg-red-600 ring-1 ring-red-800"
          title="Hotel"
        />
      </div>
    );
  }

  return (
    <div className="flex justify-center gap-px">
      {Array.from({ length: houses }, (_, i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-sm bg-emerald-600 ring-1 ring-emerald-800"
          title={`${houses} house(s)`}
        />
      ))}
    </div>
  );
}
