import { GameArtwork } from "@/components/games/artwork";
import { Button } from "@/components/ui/button";
import {
  formatDifficulty,
  formatPlayerCount,
  type GameCatalogEntry,
} from "@boardroom/shared";

interface GameCardProps {
  game: GameCatalogEntry;
  onInspect: (game: GameCatalogEntry) => void;
}

export function GameCard({ game, onInspect }: GameCardProps) {
  const availability = game.availability === "playable" ? "Playable" : "Coming soon";
  const actionLabel = game.availability === "playable" ? "Select game" : "Coming soon";

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card">
      <div className="relative aspect-[16/9]">
        <GameArtwork id={game.id} />
        <p className="absolute top-3 left-3 rounded-full bg-background/92 px-3 py-1 text-sm font-medium text-foreground">
          {availability}
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="text-2xl leading-tight">{game.name}</h3>
          {game.subtitle ? <p className="mt-1 text-base text-brass">{game.subtitle}</p> : null}
        </div>
        <p className="text-base text-muted-foreground">
          {formatPlayerCount(game.minPlayers, game.maxPlayers)}
          <span aria-hidden="true"> · </span>
          <span>{formatDifficulty(game.difficulty)}</span>
        </p>
        <p className="text-base leading-relaxed text-foreground/90">{game.description}</p>
        <div className="mt-auto pt-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full text-base"
            onClick={() => onInspect(game)}
          >
            {actionLabel}
          </Button>
        </div>
      </div>
    </article>
  );
}
