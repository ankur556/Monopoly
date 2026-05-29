import { Board } from "./components/Board/Board";
import { GamePanel } from "./components/GamePanel/GamePanel";

export default function App() {
  return (
    <div className="flex min-h-screen flex-col items-center gap-6 p-4 lg:flex-row lg:items-start lg:justify-center lg:p-8">
      <header className="sr-only">Monopoly MVP</header>
      <Board />
      <GamePanel />
    </div>
  );
}
