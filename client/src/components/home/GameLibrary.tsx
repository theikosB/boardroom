import { GameCard } from "@/components/home/GameCard";
import { GAMES, type GameCatalogEntry } from "@boardroom/shared";

interface GameLibraryProps {
  onInspect: (game: GameCatalogEntry) => void;
}

export function GameLibrary({ onInspect }: GameLibraryProps) {
  return (
    <section id="library" className="scroll-mt-24">
      <div className="max-w-2xl">
        <h2 className="text-3xl sm:text-4xl">The shelf</h2>
        <p className="mt-3 text-lg text-muted-foreground">
          Nine games. None of them are playable yet. Battleship is the one we will open first, and the
          rest stay here until their rules are written.
        </p>
      </div>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {GAMES.map((game) => (
          <GameCard key={game.id} game={game} onInspect={onInspect} />
        ))}
      </div>
    </section>
  );
}
