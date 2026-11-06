import { Button } from "@/components/ui/button";
import { UNO_COLORS, type UnoCard, type UnoColor, type UnoMove, type UnoView } from "@boardroom/shared";
import { useState } from "react";

interface UnoTableProps {
  view: UnoView;
  pending: boolean;
  winnerName: string | null;
  names: Record<string, string>;
  onMove: (move: UnoMove) => void;
}

const SWATCH: Record<UnoCard["color"], string> = {
  red: "#b42318",
  yellow: "#a97800",
  green: "#1f7a45",
  blue: "#1d5fbf",
  wild: "#2c2824",
};

const RANK_ORDER = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "reverse", "draw2", "wild", "draw4"];

function label(card: UnoCard): string {
  if (card.rank === "skip") return "Skip";
  if (card.rank === "reverse") return "Reverse";
  if (card.rank === "draw2") return "+2";
  if (card.rank === "wild") return "Wild";
  if (card.rank === "draw4") return "+4";
  return card.rank;
}

function sortHand(cards: readonly UnoCard[]): UnoCard[] {
  const colors = [...UNO_COLORS, "wild"] as const;
  return [...cards].sort((left, right) => {
    const colorGap = colors.indexOf(left.color) - colors.indexOf(right.color);
    if (colorGap !== 0) return colorGap;
    return RANK_ORDER.indexOf(left.rank) - RANK_ORDER.indexOf(right.rank);
  });
}

export function UnoTable({ view, pending, winnerName, names, onMove }: UnoTableProps) {
  const [wildId, setWildId] = useState<string | null>(null);
  const hand = sortHand(view.yourHand);
  const status = view.phase === "finished"
    ? view.winnerId
      ? winnerName
        ? `${winnerName} went out.`
        : "The hand is empty."
      : (view.reason ?? "The match is over.")
    : view.needsColor
      ? "Choose a color."
      : view.yourTurn
        ? "Your turn."
        : "Waiting for the next player.";

  function play(card: UnoCard, color?: UnoColor) {
    if (card.rank === "wild" || card.rank === "draw4") {
      if (!color) {
        setWildId(card.id);
        return;
      }
      setWildId(null);
      onMove({ type: "play", cardId: card.id, color });
      return;
    }
    setWildId(null);
    onMove({ type: "play", cardId: card.id });
  }

  return (
    <div className="grid gap-6">
      <div>
        <p className="font-heading text-3xl" data-testid="match-status">
          {status}
        </p>
        <p className="mt-2 text-base text-muted-foreground" role="status">
          {view.notice ?? "Match the color or the symbol. A draw four needs a hand with no card of the current color."}
        </p>
      </div>

      <ul className="flex flex-wrap gap-2">
        {view.opponents.map((opponent) => (
          <li key={opponent.playerId} className="flex items-center gap-2 rounded-full border bg-card px-3 py-2 text-base">
            <span>
              {names[opponent.playerId] ?? "Player"} · {opponent.count} {opponent.count === 1 ? "card" : "cards"}
              {opponent.calledUno ? " · UNO" : ""}
            </span>
            {view.canCatchIds.includes(opponent.playerId) ? (
              <Button
                type="button"
                variant="outline"
                className="h-9 px-3 text-base"
                data-testid={`catch-${opponent.playerId}`}
                disabled={pending}
                onClick={() => onMove({ type: "catch", playerId: opponent.playerId })}
              >
                Catch
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      <section className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4">
        {view.discardTop ? (
          <CardFace card={view.discardTop} large testId="discard-top" />
        ) : (
          <p>No discard yet.</p>
        )}
        <div>
          <p className="text-base text-muted-foreground">Color in play</p>
          <p className="text-2xl capitalize">{view.activeColor ?? "Choose"}</p>
          <p className="mt-2 text-base text-muted-foreground">
            {view.drawCount} in the deck · {view.direction === "clockwise" ? "Clockwise" : "Counterclockwise"}
          </p>
        </div>
      </section>

      {view.needsColor ? (
        <ColorRow
          disabled={pending}
          onPick={(color) => onMove({ type: "choose-color", color })}
        />
      ) : null}

      {wildId ? (
        <div>
          <p className="mb-2 text-base">Play this wild as</p>
          <ColorRow
            disabled={pending}
            onPick={(color) => {
              const card = hand.find((item) => item.id === wildId);
              if (card) play(card, color);
            }}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {view.yourTurn && !view.needsColor ? (
          <Button type="button" variant="outline" className="h-11 text-base" data-testid="draw-card" disabled={pending || view.drawnPlayable} onClick={() => onMove({ type: "draw" })}>
            Draw
          </Button>
        ) : null}
        {view.drawnPlayable ? (
          <Button type="button" variant="outline" className="h-11 text-base" data-testid="pass-turn" disabled={pending} onClick={() => onMove({ type: "pass" })}>
            Pass
          </Button>
        ) : null}
        {view.mustCallUno ? (
          <Button type="button" className="h-11 text-base" data-testid="call-uno" disabled={pending} onClick={() => onMove({ type: "call-uno" })}>
            Call UNO
          </Button>
        ) : null}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {hand.map((card) => (
          <button
            key={card.id}
            type="button"
            data-testid={`card-${card.id}`}
            disabled={pending || !view.yourTurn || view.needsColor || view.phase === "finished"}
            onClick={() => play(card)}
            className="shrink-0 disabled:cursor-default"
          >
            <CardFace card={card} />
          </button>
        ))}
      </div>

      {view.phase === "finished" && view.revealedHands ? (
        <div className="grid gap-3">
          {view.revealedHands
            .filter((hand) => hand.cards.length > 0)
            .map((hand) => (
              <p key={hand.playerId} className="text-base text-muted-foreground">
                {hand.cards.length} cards left at the table.
              </p>
            ))}
        </div>
      ) : null}
    </div>
  );
}

function ColorRow({ disabled, onPick }: { disabled: boolean; onPick: (color: UnoColor) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {UNO_COLORS.map((color) => (
        <Button
          key={color}
          type="button"
          className="h-11 px-4 text-base capitalize"
          style={{ backgroundColor: SWATCH[color], color: "white" }}
          data-testid={`color-${color}`}
          disabled={disabled}
          onClick={() => onPick(color)}
        >
          {color}
        </Button>
      ))}
    </div>
  );
}

function CardFace({ card, large = false, testId }: { card: UnoCard; large?: boolean; testId?: string }) {
  return (
    <span
      data-testid={testId}
      className={`grid place-items-center rounded-xl font-heading text-white ${large ? "h-28 w-20 text-2xl" : "h-24 w-16 text-xl"}`}
      style={{ backgroundColor: SWATCH[card.color] }}
    >
      {label(card)}
    </span>
  );
}
