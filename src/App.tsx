import { Board } from "./components/Board/Board";
import { BoardFrame } from "./components/Board/BoardFrame";
import { PropertyCardFlip } from "./components/Board/PropertyCardFlip";
import { GamePanel } from "./components/GamePanel/GamePanel";
import { TradeModal } from "./components/Trade/TradeModal";
import { ThemeToggle } from "./components/ui/ThemeToggle";

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--bg-gradient-from)] via-[var(--bg-gradient-via)] to-[var(--bg-gradient-to)]">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Monopoly
        </h1>
        <ThemeToggle />
      </header>

      <main className="flex flex-col items-center gap-6 px-2 pb-8 lg:flex-row lg:items-start lg:justify-center lg:gap-8 lg:px-6">
        <BoardFrame>
          <Board />
        </BoardFrame>
        <GamePanel />
      </main>

      <PropertyCardFlip />
      <TradeModal />
    </div>
  );
}
