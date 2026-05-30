import type { ReactNode } from "react";

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
}

export function GlassPanel({ children, className = "" }: GlassPanelProps) {
  return (
    <div
      data-glass=""
      className={`rounded-2xl border shadow-2xl backdrop-blur-xl ${className}`}
      style={{
        backgroundColor: "var(--glass-bg)",
        borderColor: "var(--glass-border)",
        color: "var(--glass-text)",
      }}
    >
      {children}
    </div>
  );
}
