import type { ReactNode } from "react";
import { GlassPanel } from "../ui/GlassPanel";

interface BoardFrameProps {
  children: ReactNode;
}

/** Flat 2D top-down board wrapper with glass surround. */
export function BoardFrame({ children }: BoardFrameProps) {
  return (
    <div className="flex w-full justify-center px-1 py-3 sm:px-2 sm:py-4">
      <GlassPanel className="w-full max-w-[min(100vw-1rem,72rem)] p-1.5 sm:p-2">
        {children}
      </GlassPanel>
    </div>
  );
}
