import { GameLibrary } from "@/components/home/GameLibrary";
import { Hero } from "@/components/home/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { InfoDialog } from "@/components/home/InfoDialog";
import { type ShelfDialog } from "@/components/home/shelfDialog";
import type { GameCatalogEntry } from "@boardroom/shared";
import { useState } from "react";

export function HomePage() {
  const [dialog, setDialog] = useState<ShelfDialog | null>(null);

  function inspect(game: GameCatalogEntry) {
    setDialog({ kind: "game", game });
  }

  return (
    <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-4 py-10 sm:px-6 sm:py-14">
      <div id="top" className="scroll-mt-24">
        <Hero
          onCreate={() => setDialog({ kind: "room", intent: "create" })}
          onJoin={() => setDialog({ kind: "room", intent: "join" })}
        />
      </div>
      <HowItWorks />
      <GameLibrary onInspect={inspect} />
      <InfoDialog
        dialog={dialog}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      />
    </main>
  );
}
