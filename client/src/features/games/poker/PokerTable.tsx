import { Button } from "@/components/ui/button";
import type { PokerCard, PokerMove, PokerView } from "@boardroom/shared";

interface PokerTableProps {
  view: PokerView;
  pending: boolean;
  winnerName: string | null;
  names: Record<string, string>;
  onMove: (move: PokerMove) => void;
}

const SUIT: Record<PokerCard["suit"], string> = {
  clubs: "♣",
  diamonds: "♦",
  hearts: "♥",
  spades: "♠",
};

function chips(amount: number): string {
  return `${amount.toLocaleString("en-US")} play chips`;
}

export function PokerTable({ view, pending, winnerName, names, onMove }: PokerTableProps) {
  const status = view.phase === "finished"
    ? view.winnerId
      ? winnerName
        ? `${winnerName} has the chips.`
        : "The table is done."
      : (view.reason ?? "The match is over.")
    : view.street === "showdown"
      ? "Hand over."
      : view.yourTurn
        ? "Your turn."
        : "Waiting for the next player.";
  return (
    <div className="grid gap-6">
      <div>
        <p className="font-heading text-3xl" data-testid="turn-status">
          {status}
        </p>
        <p className="mt-2 text-base text-muted-foreground" role="status">
          {view.notice ?? "Texas Hold'em with play chips. Nothing here is real money."}
        </p>
      </div>

      <div>
        <p className="mb-2 text-base text-muted-foreground">
          Your stack {chips(view.stack)}
          {view.yourHandName ? ` · ${view.yourHandName}` : ""}
        </p>
        <div className="flex gap-2">
          {view.yourHole.map((card, index) => (
            <CardFace key={card.id} card={card} testId={`hole-${index}`} />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {view.yourTurn ? (
          <Button type="button" variant="outline" className="h-11 text-base" data-testid="fold" disabled={pending} onClick={() => onMove({ type: "fold" })}>
            Fold
          </Button>
        ) : null}
        {view.canCheck ? (
          <Button type="button" variant="outline" className="h-11 text-base" data-testid="check" disabled={pending} onClick={() => onMove({ type: "check" })}>
            Check
          </Button>
        ) : null}
        {view.canCall ? (
          <Button type="button" className="h-11 text-base" data-testid="call" disabled={pending} onClick={() => onMove({ type: "call" })}>
            Call {view.toCall}
          </Button>
        ) : null}
        {view.minAmount !== null ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 text-base"
            data-testid="bet-min"
            disabled={pending}
            onClick={() => onMove({ type: "bet", amount: view.minAmount ?? 0 })}
          >
            {view.canBet ? `Bet ${view.minAmount}` : `Raise to ${view.minAmount}`}
          </Button>
        ) : null}
        {view.maxAmount > (view.minAmount ?? 0) && (view.canBet || view.canRaise) ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 text-base"
            data-testid="all-in"
            disabled={pending}
            onClick={() => onMove({ type: "bet", amount: view.maxAmount })}
          >
            All in
          </Button>
        ) : null}
        {view.canDeal ? (
          <Button type="button" className="h-11 text-base" data-testid="deal" disabled={pending} onClick={() => onMove({ type: "deal" })}>
            Next hand
          </Button>
        ) : null}
      </div>

      <ul className="flex flex-wrap gap-2">
        {view.opponents.map((opponent) => (
          <li key={opponent.playerId} className="rounded-full border bg-card px-3 py-2 text-base">
            {names[opponent.playerId] ?? "Player"}
            {opponent.isButton ? " · Button" : ""}
            {` · ${chips(opponent.stack)}`}
            {opponent.bet > 0 ? ` · bet ${opponent.bet}` : ""}
            {opponent.folded ? " · folded" : ""}
            {opponent.allIn ? " · all in" : ""}
          </li>
        ))}
      </ul>

      <section className="grid gap-4 rounded-2xl border bg-card p-4">
        <div>
          <p className="text-base text-muted-foreground">Pot</p>
          <p className="text-2xl" data-testid="pot">
            {chips(view.pot)}
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {view.board.length === 0 ? <p className="text-base text-muted-foreground">No community cards yet.</p> : null}
          {view.board.map((card, index) => (
            <CardFace key={card.id} card={card} testId={`board-${index}`} />
          ))}
        </div>
        {view.winners && view.winners.length > 0 ? (
          <p className="text-base">
            {view.winners
              .map((winner) => {
                const name = names[winner.playerId] ?? "Player";
                return winner.handName === "Took the pot"
                  ? `${name} takes ${chips(winner.amount)}`
                  : `${name} takes ${chips(winner.amount)} with ${winner.handName}`;
              })
              .join(". ")}
          </p>
        ) : null}
      </section>

      {view.opponents.some((opponent) => opponent.hole && opponent.hole.length > 0) ? (
        <div className="grid gap-2">
          {view.opponents
            .filter((opponent) => opponent.hole && opponent.hole.length > 0)
            .map((opponent) => (
              <div key={opponent.playerId} className="flex items-center gap-2">
                <p className="text-base">{names[opponent.playerId] ?? "Player"}</p>
                {opponent.hole?.map((card) => (
                  <CardFace key={card.id} card={card} testId={`shown-${opponent.playerId}-${card.id}`} />
                ))}
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}

function CardFace({ card, testId }: { card: PokerCard; testId?: string }) {
  const red = card.suit === "hearts" || card.suit === "diamonds";
  return (
    <span
      data-testid={testId}
      data-card-id={card.id}
      className="grid h-24 w-16 shrink-0 place-items-center rounded-xl bg-white text-xl font-heading"
      style={{ color: red ? "#9f2d2d" : "#1c1917" }}
    >
      {card.rank === "T" ? "10" : card.rank}
      {SUIT[card.suit]}
    </span>
  );
}
