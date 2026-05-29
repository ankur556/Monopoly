import type { ReactNode } from "react";
import { GlassPanel } from "../ui/GlassPanel";

interface BoardFrameProps {
  children: ReactNode;
}

/** Flat 2D top-down board wrapper with glass surround. */
export function BoardFrame({ children }: BoardFrameProps) {
  return (
    <div className="flex w-full justify-center px-2 py-4 sm:px-4 sm:py-6">
      <GlassPanel className="w-full max-w-[min(100vw-1.5rem,44rem)] p-2 sm:p-3">
        {children}
      </GlassPanel>
    </div>
  );
}
