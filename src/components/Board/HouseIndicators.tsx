interface HouseIndicatorsProps {
  houses: number;
}

/** Tiny SVG house icon for board tiles */
function HouseSVG() {
  return (
    <svg
      viewBox="0 0 10 10"
      className="h-2 w-2 shrink-0 drop-shadow-sm"
      aria-hidden="true"
    >
      {/* Roof */}
      <polygon points="5,1 9.5,5 0.5,5" fill="#16a34a" stroke="#14532d" strokeWidth="0.5" />
      {/* Walls */}
      <rect x="2" y="5" width="6" height="4.2" fill="#22c55e" stroke="#14532d" strokeWidth="0.5" />
      {/* Door */}
      <rect x="4" y="7" width="2" height="2.2" fill="#14532d" />
    </svg>
  );
}

/** Tiny SVG hotel icon for board tiles */
function HotelSVG() {
  return (
    <svg
      viewBox="0 0 12 10"
      className="h-2.5 w-3 shrink-0 drop-shadow-sm"
      aria-hidden="true"
    >
      {/* Roof */}
      <polygon points="6,0.5 11.5,4.5 0.5,4.5" fill="#dc2626" stroke="#7f1d1d" strokeWidth="0.5" />
      {/* Main body */}
      <rect x="1" y="4.5" width="10" height="5" fill="#ef4444" stroke="#7f1d1d" strokeWidth="0.5" />
      {/* Windows */}
      <rect x="2.5" y="5.8" width="2" height="1.8" fill="#fef9c3" />
      <rect x="7.5" y="5.8" width="2" height="1.8" fill="#fef9c3" />
      {/* Door */}
      <rect x="4.8" y="7" width="2.4" height="2.5" fill="#7f1d1d" />
    </svg>
  );
}

export function HouseIndicators({ houses }: HouseIndicatorsProps) {
  if (houses <= 0) return null;

  if (houses >= 5) {
    return (
      <div className="flex justify-center pb-px" title="Hotel">
        <HotelSVG />
      </div>
    );
  }

  return (
    <div className="flex justify-center gap-px pb-px" title={`${houses} house${houses > 1 ? "s" : ""}`}>
      {Array.from({ length: houses }, (_, i) => (
        <HouseSVG key={i} />
      ))}
    </div>
  );
}
