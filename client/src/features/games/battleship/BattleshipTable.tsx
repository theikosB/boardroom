import { Button } from "@/components/ui/button";
import {
  BATTLESHIP_FLEET,
  type BattleshipMove,
  type BattleshipView,
  type Coord,
  type FleetPlacement,
  type ShipDirection,
  type ShipKind,
} from "@boardroom/shared";
import { useEffect, useRef, useState } from "react";

interface BattleshipTableProps {
  view: BattleshipView;
  pending: boolean;
  winnerName: string | null;
  onMove: (move: BattleshipMove) => void;
}

const LETTERS = "ABCDEFGHIJ".split("");

function shipLength(kind: ShipKind): number {
  return BATTLESHIP_FLEET.find((ship) => ship.kind === kind)?.length ?? 0;
}

function shipName(kind: ShipKind): string {
  return BATTLESHIP_FLEET.find((ship) => ship.kind === kind)?.name ?? "ship";
}

function cellsFor(placement: FleetPlacement): Coord[] | null {
  const cells: Coord[] = [];
  for (let step = 0; step < shipLength(placement.kind); step += 1) {
    const r = placement.dir === "vertical" ? placement.r + step : placement.r;
    const c = placement.dir === "horizontal" ? placement.c + step : placement.c;
    if (r < 0 || c < 0 || r > 9 || c > 9) return null;
    cells.push({ r, c });
  }
  return cells;
}

function keyOf(r: number, c: number): string {
  return `${r},${c}`;
}

function squareName(r: number, c: number): string {
  return `${LETTERS[c] ?? ""}${r + 1}`;
}

export function BattleshipTable({ view, pending, winnerName, onMove }: BattleshipTableProps) {
  const [placed, setPlaced] = useState<FleetPlacement[]>([]);
  const [selected, setSelected] = useState<ShipKind>("carrier");
  const [direction, setDirection] = useState<ShipDirection>("horizontal");
  const [hover, setHover] = useState<Coord | null>(null);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const wasPlaced = useRef(view.youPlaced);

  useEffect(() => {
    if (wasPlaced.current && !view.youPlaced) {
      setPlaced([]);
      setSelected("carrier");
      setDirection("horizontal");
      setLocalMessage(null);
    }
    wasPlaced.current = view.youPlaced;
  }, [view.youPlaced]);

  const lockedCells = new Map<string, ShipKind>();
  if (view.youPlaced) {
    for (const ship of view.yourFleet) {
      for (const cell of ship.cells) lockedCells.set(keyOf(cell.r, cell.c), ship.kind);
    }
  } else {
    for (const ship of placed) {
      for (const cell of cellsFor(ship) ?? []) lockedCells.set(keyOf(cell.r, cell.c), ship.kind);
    }
  }

  const preview = !view.youPlaced && hover ? cellsFor({ kind: selected, r: hover.r, c: hover.c, dir: direction }) : null;
  const previewKeys = new Set((preview ?? []).map((cell) => keyOf(cell.r, cell.c)));
  const previewBlocked = !preview || preview.some((cell) => lockedCells.has(keyOf(cell.r, cell.c)));

  function placeAt(r: number, c: number) {
    if (view.youPlaced || pending) return;
    const occupied = placed.find((ship) => (cellsFor(ship) ?? []).some((cell) => cell.r === r && cell.c === c));
    if (occupied) {
      setPlaced(placed.filter((ship) => ship.kind !== occupied.kind));
      setSelected(occupied.kind);
      setLocalMessage(null);
      return;
    }
    const draft: FleetPlacement = { kind: selected, r, c, dir: direction };
    const cells = cellsFor(draft);
    if (!cells) {
      setLocalMessage("That ship does not fit there.");
      return;
    }
    if (placed.some((ship) => ship.kind === selected)) {
      setLocalMessage("Pick that ship up before placing it again.");
      return;
    }
    if (cells.some((cell) => lockedCells.has(keyOf(cell.r, cell.c)))) {
      setLocalMessage("Ships cannot overlap.");
      return;
    }
    const next = [...placed, draft];
    setPlaced(next);
    setLocalMessage(null);
    const upcoming = BATTLESHIP_FLEET.find((ship) => !next.some((item) => item.kind === ship.kind));
    if (upcoming) setSelected(upcoming.kind);
  }

  const incoming = new Map(view.incoming.map((shot) => [keyOf(shot.r, shot.c), shot]));
  const shots = new Map(view.yourShots.map((shot) => [keyOf(shot.r, shot.c), shot]));
  const revealed = new Map<string, ShipKind>();
  for (const ship of view.opponentFleet ?? []) {
    for (const cell of ship.cells) revealed.set(keyOf(cell.r, cell.c), ship.kind);
  }

  const status = view.phase === "finished"
    ? view.winnerId
      ? winnerName
        ? `${winnerName} sank the fleet.`
        : "The fleet is sunk."
      : (view.reason ?? "The match is over.")
    : view.phase === "placement"
      ? view.youPlaced
        ? "Fleet confirmed. Waiting for the other player."
        : "Place all five ships, then confirm."
      : view.yourTurn
        ? "Your shot."
        : "Waiting for the other player.";

  return (
    <div className="grid gap-6">
      <div>
        <p className="font-heading text-3xl" data-testid="match-status">
          {status}
        </p>
        <p className="mt-2 text-base text-muted-foreground" role="status">
          {localMessage ?? view.notice ?? "Shots alternate. A hit does not grant another turn."}
        </p>
      </div>

      {view.phase === "placement" && !view.youPlaced ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            {BATTLESHIP_FLEET.map((ship) => {
              const used = placed.some((item) => item.kind === ship.kind);
              return (
                <Button
                  key={ship.kind}
                  type="button"
                  variant={selected === ship.kind ? "default" : "outline"}
                  className="h-10 px-3 text-base"
                  data-testid={`ship-${ship.kind}`}
                  onClick={() => setSelected(ship.kind)}
                >
                  {ship.name}
                  {used ? " · placed" : ` · ${ship.length}`}
                </Button>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-10 px-3 text-base"
            data-testid="rotate"
            onClick={() => setDirection((current) => (current === "horizontal" ? "vertical" : "horizontal"))}
          >
            {direction === "horizontal" ? "Horizontal" : "Vertical"}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row">
        <Board
          title="Your fleet"
          testPrefix="own"
          className={view.phase === "placement" ? "" : "order-2 lg:order-1"}
          onHover={view.phase === "placement" && !view.youPlaced ? setHover : undefined}
          onLeave={() => setHover(null)}
          onSelect={view.phase === "placement" && !view.youPlaced ? placeAt : undefined}
          cell={(r, c) => {
            const key = keyOf(r, c);
            const ship = lockedCells.get(key);
            const shot = incoming.get(key);
            const inPreview = previewKeys.has(key);
            return {
              label: ship
                ? `${squareName(r, c)}, your ${shipName(ship)}`
                : inPreview
                  ? `${squareName(r, c)}, preview`
                  : squareName(r, c),
              className: shot
                ? shot.result === "miss"
                  ? "bg-muted"
                  : "bg-destructive text-primary-foreground"
                : ship
                  ? "bg-primary text-primary-foreground"
                  : inPreview
                    ? previewBlocked
                      ? "bg-destructive/35"
                      : "bg-brass/45"
                    : "bg-muted/70",
              mark: shot ? (shot.result === "miss" ? "·" : shot.result === "sunk" ? "✕" : "●") : "",
            };
          }}
        />
        {view.phase === "placement" ? null : (
          <Board
            title="Their water"
            testPrefix="target"
            className="order-1 lg:order-2"
            onSelect={
              view.phase === "battle" && !pending
                ? (r, c) => onMove({ type: "fire", r, c })
                : undefined
            }
            cell={(r, c) => {
              const key = keyOf(r, c);
              const shot = shots.get(key);
              const ship = revealed.get(key);
              return {
                label: shot
                  ? `${squareName(r, c)}, ${shot.result}${shot.sunkKind ? ` ${shipName(shot.sunkKind)}` : ""}`
                  : `Fire at ${squareName(r, c)}`,
                className: shot
                  ? shot.result === "miss"
                    ? "bg-muted"
                    : "bg-destructive text-primary-foreground"
                  : ship
                    ? "bg-primary/70 text-primary-foreground"
                    : "bg-muted/70",
                mark: shot ? (shot.result === "miss" ? "·" : shot.result === "sunk" ? "✕" : "●") : ship ? "■" : "",
              };
            }}
          />
        )}
      </div>

      {view.phase === "placement" && !view.youPlaced ? (
        <Button
          type="button"
          className="h-11 text-base sm:w-fit"
          data-testid="confirm-fleet"
          disabled={pending || placed.length !== BATTLESHIP_FLEET.length}
          onClick={() => onMove({ type: "place", ships: placed })}
        >
          Confirm fleet
        </Button>
      ) : null}
    </div>
  );
}

interface CellPaint {
  label: string;
  className: string;
  mark: string;
}

function Board({
  title,
  testPrefix,
  className,
  cell,
  onSelect,
  onHover,
  onLeave,
}: {
  title: string;
  testPrefix: "own" | "target";
  className?: string;
  cell: (r: number, c: number) => CellPaint;
  onSelect?: (r: number, c: number) => void;
  onHover?: (cell: Coord) => void;
  onLeave?: () => void;
}) {
  return (
    <section className={`min-w-0 flex-1 rounded-2xl border bg-card p-3 sm:p-4 ${className ?? ""}`}>
      <h3 className="text-2xl">{title}</h3>
      <div
        className="mt-3 grid grid-cols-[1.25rem_repeat(10,minmax(0,1fr))] gap-1"
        onMouseLeave={onLeave}
      >
        <span />
        {LETTERS.map((letter) => (
          <span key={letter} className="text-center text-xs font-medium text-muted-foreground">
            {letter}
          </span>
        ))}
        {Array.from({ length: 10 }, (_, r) => (
          <div key={r} className="contents">
            <span className="text-xs leading-none text-muted-foreground self-center">{r + 1}</span>
            {Array.from({ length: 10 }, (_, c) => {
              const paint = cell(r, c);
              return (
                <button
                  key={c}
                  type="button"
                  data-testid={`${testPrefix}-${r}-${c}`}
                  aria-label={paint.label}
                  disabled={!onSelect}
                  onMouseEnter={() => onHover?.({ r, c })}
                  onClick={() => onSelect?.(r, c)}
                  className={`grid aspect-square place-items-center rounded-sm text-xs font-medium ${paint.className} disabled:cursor-default`}
                >
                  {paint.mark}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
