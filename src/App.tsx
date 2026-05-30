import { useGameStore } from "./store/gameStore";
import { Board } from "./components/Board/Board";
import { AuctionModal } from "./components/Board/AuctionModal";
import { BoardFrame } from "./components/Board/BoardFrame";
import { MovementController } from "./components/Board/MovementController";
import { PropertyCardModal } from "./components/Board/PropertyCardModal";
import { GamePanel } from "./components/GamePanel/GamePanel";
import { StartMenu } from "./components/Menu/StartMenu";
import { TradeModal } from "./components/Trade/TradeModal";
import { ThemeToggle } from "./components/ui/ThemeToggle";

export default function App() {
  const appScreen = useGameStore((s) => s.appScreen);
  const returnToMenu = useGameStore((s) => s.returnToMenu);

  if (appScreen === "MENU") {
    return <StartMenu />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--bg-gradient-from)] via-[var(--bg-gradient-via)] to-[var(--bg-gradient-to)]">
      {/* Invisible movement engine — fires stepToken every 280ms during a roll */}
      <MovementController />

      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <button
          type="button"
          onClick={() => {
            if (confirm("Return to the main menu? Your current game will be lost.")) {
              returnToMenu();
            }
          }}
          className="text-xl font-bold tracking-tight opacity-80 transition hover:opacity-100 sm:text-2xl"
          title="Return to main menu"
        >
          Monopoly ↩
        </button>
        <ThemeToggle />
      </header>

      <main className="flex flex-col items-center gap-6 px-2 pb-8 lg:flex-row lg:items-start lg:justify-center lg:gap-8 lg:px-6">
        <BoardFrame>
          <Board />
        </BoardFrame>
        <GamePanel />
      </main>

      {/* Modals */}
      <PropertyCardModal />
      <TradeModal />
      <AuctionModal />
    </div>
  );
}
