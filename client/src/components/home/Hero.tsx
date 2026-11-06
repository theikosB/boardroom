import { EmptyTable } from "@/components/home/EmptyTable";
import { Button } from "@/components/ui/button";

interface HeroProps {
  onCreate: () => void;
  onJoin: () => void;
}

export function Hero({ onCreate, onJoin }: HeroProps) {
  return (
    <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
      <div>
        <p className="text-base font-medium text-brass">For your group, in the browser</p>
        <h1 className="mt-3 max-w-xl text-4xl leading-[1.08] text-balance sm:text-6xl">
          A table that belongs to your friends.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Boardroom is a private place to play board games together. Someone opens a room,
          shares a short code, and everyone else sits down from their own screen. Battleship
          and UNO are ready. The rest of the shelf is still being built.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button type="button" className="h-12 px-5 text-base" onClick={onCreate}>
            Create a room
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 px-5 text-base"
            onClick={onJoin}
          >
            Join with a code
          </Button>
        </div>
        <p className="mt-4 max-w-xl text-base text-muted-foreground">
          Both players use the same Boardroom server. A refresh keeps your seat. Closing the
          host's browser does not end the match.
        </p>
      </div>
      <EmptyTable />
    </section>
  );
}
