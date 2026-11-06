import {
  BATTLESHIP_FLEET,
  type BattleshipMove,
  type BattleshipView,
  type Coord,
  type FleetPlacement,
  type GameEngine,
  type ShipKind,
  type VisibleShip,
} from "@boardroom/shared";

export interface ServerShip {
  kind: ShipKind;
  cells: Coord[];
  hits: number;
}

export interface Shot {
  r: number;
  c: number;
  result: "miss" | "hit" | "sunk";
  sunkKind?: ShipKind;
}

export interface BattleshipState {
  phase: "placement" | "battle" | "finished";
  playerIds: [string, string];
  fleets: Record<string, ServerShip[]>;
  shots: Record<string, Shot[]>;
  locked: Record<string, boolean>;
  turnPlayerId: string | null;
  winnerId: string | null;
  reason: string | null;
  noticeFor: Record<string, string | null>;
}

const LENGTHS = new Map(BATTLESHIP_FLEET.map((ship) => [ship.kind, ship.length]));
const NAMES = new Map(BATTLESHIP_FLEET.map((ship) => [ship.kind, ship.name]));

function otherPlayer(state: BattleshipState, playerId: string): string {
  const other = state.playerIds.find((id) => id !== playerId);
  if (!other) throw new Error("Player is not in this match.");
  return other;
}

function cellsFor(placement: FleetPlacement): Coord[] | null {
  const length = LENGTHS.get(placement.kind);
  if (!length) return null;
  const cells: Coord[] = [];
  for (let step = 0; step < length; step += 1) {
    const r = placement.dir === "vertical" ? placement.r + step : placement.r;
    const c = placement.dir === "horizontal" ? placement.c + step : placement.c;
    if (r < 0 || c < 0 || r > 9 || c > 9) return null;
    cells.push({ r, c });
  }
  return cells;
}

function fleetFromPlacement(ships: FleetPlacement[]): { ok: true; fleet: ServerShip[] } | { ok: false; reason: string } {
  if (ships.length !== BATTLESHIP_FLEET.length) {
    return { ok: false, reason: "Place the whole fleet before confirming." };
  }
  const seen = new Set<string>();
  const occupied = new Set<string>();
  const fleet: ServerShip[] = [];
  for (const placement of ships) {
    if (seen.has(placement.kind)) {
      return { ok: false, reason: "Each ship can be placed once." };
    }
    seen.add(placement.kind);
    const cells = cellsFor(placement);
    if (!cells) return { ok: false, reason: "A ship is off the board." };
    for (const cell of cells) {
      const key = `${cell.r},${cell.c}`;
      if (occupied.has(key)) return { ok: false, reason: "Ships cannot overlap." };
      occupied.add(key);
    }
    fleet.push({ kind: placement.kind, cells, hits: 0 });
  }
  if (seen.size !== BATTLESHIP_FLEET.length) {
    return { ok: false, reason: "The fleet is missing a ship." };
  }
  return { ok: true, fleet };
}

function findShip(fleet: ServerShip[], r: number, c: number): ServerShip | undefined {
  return fleet.find((ship) => ship.cells.some((cell) => cell.r === r && cell.c === c));
}

function allSunk(fleet: ServerShip[]): boolean {
  return fleet.every((ship) => ship.hits >= ship.cells.length);
}

function toVisible(ship: ServerShip): VisibleShip {
  return { kind: ship.kind, cells: ship.cells.map((cell) => ({ ...cell })), hits: ship.hits };
}

export function createGame(playerIds: readonly string[]): BattleshipState {
  if (playerIds.length !== 2) throw new Error("Battleship needs two players.");
  const [first, second] = playerIds as [string, string];
  return {
    phase: "placement",
    playerIds: [first, second],
    fleets: { [first]: [], [second]: [] },
    shots: { [first]: [], [second]: [] },
    locked: { [first]: false, [second]: false },
    turnPlayerId: null,
    winnerId: null,
    reason: null,
    noticeFor: { [first]: null, [second]: null },
  };
}

export function endByHost(state: BattleshipState): BattleshipState {
  const next = structuredClone(state);
  next.phase = "finished";
  next.winnerId = null;
  next.reason = "The host ended the match.";
  next.turnPlayerId = null;
  for (const id of next.playerIds) next.noticeFor[id] = "The host ended the match.";
  return next;
}

export function forfeit(state: BattleshipState, leaverId: string): BattleshipState {
  const winnerId = otherPlayer(state, leaverId);
  const next = structuredClone(state);
  next.phase = "finished";
  next.winnerId = winnerId;
  next.reason = "The other player left the table.";
  next.turnPlayerId = null;
  next.noticeFor[winnerId] = "The other player left. The fleet is yours.";
  next.noticeFor[leaverId] = "You left the table.";
  return next;
}

function validate(state: BattleshipState, playerId: string, move: BattleshipMove) {
  if (!state.playerIds.includes(playerId)) {
    return { ok: false as const, reason: "You are not seated in this match." };
  }
  if (state.phase === "finished") {
    return { ok: false as const, reason: "This match is over." };
  }
  if (move.type === "place") {
    if (state.phase !== "placement") {
      return { ok: false as const, reason: "The fleets are already locked." };
    }
    const placed = fleetFromPlacement(move.ships);
    if (!placed.ok) return placed;
    return { ok: true as const };
  }
  if (state.phase !== "battle") {
    return { ok: false as const, reason: "Both fleets have to be placed first." };
  }
  if (state.turnPlayerId !== playerId) {
    return { ok: false as const, reason: "Wait for your turn." };
  }
  if (move.r < 0 || move.c < 0 || move.r > 9 || move.c > 9) {
    return { ok: false as const, reason: "That square is off the board." };
  }
  const already = state.shots[playerId]?.some((shot) => shot.r === move.r && shot.c === move.c);
  if (already) return { ok: false as const, reason: "You already fired there." };
  return { ok: true as const };
}

function apply(state: BattleshipState, playerId: string, move: BattleshipMove): BattleshipState {
  const next = structuredClone(state);
  if (move.type === "place") {
    const placed = fleetFromPlacement(move.ships);
    if (!placed.ok) return state;
    next.fleets[playerId] = placed.fleet;
    next.locked[playerId] = true;
    next.noticeFor[playerId] = "Fleet confirmed.";
    const opponentId = otherPlayer(next, playerId);
    next.noticeFor[opponentId] = next.locked[opponentId]
      ? "Both fleets are set."
      : "Your opponent has placed a fleet.";
    if (next.locked[next.playerIds[0]] && next.locked[next.playerIds[1]]) {
      next.phase = "battle";
      const first = next.playerIds[Math.floor(Math.random() * next.playerIds.length)] ?? next.playerIds[0];
      next.turnPlayerId = first;
      next.noticeFor[first] = "Your shot.";
      next.noticeFor[otherPlayer(next, first)] = "Waiting for the first shot.";
    }
    return next;
  }

  const opponentId = otherPlayer(next, playerId);
  const fleet = next.fleets[opponentId] ?? [];
  const ship = findShip(fleet, move.r, move.c);
  const shot: Shot = { r: move.r, c: move.c, result: "miss" };
  if (ship) {
    ship.hits += 1;
    if (ship.hits >= ship.cells.length) {
      shot.result = "sunk";
      shot.sunkKind = ship.kind;
      const name = NAMES.get(ship.kind) ?? "ship";
      next.noticeFor[playerId] = `You sank their ${name}.`;
      next.noticeFor[opponentId] = `Your ${name} sank.`;
    } else {
      shot.result = "hit";
      next.noticeFor[playerId] = "Hit.";
      next.noticeFor[opponentId] = "Your fleet was hit.";
    }
  } else {
    next.noticeFor[playerId] = "Miss.";
    next.noticeFor[opponentId] = "The shot missed.";
  }
  next.shots[playerId] = [...(next.shots[playerId] ?? []), shot];
  if (allSunk(fleet)) {
    next.phase = "finished";
    next.winnerId = playerId;
    next.turnPlayerId = null;
    next.reason = "Every opposing ship sank.";
    next.noticeFor[playerId] = "You sank the fleet.";
    next.noticeFor[opponentId] = "Your fleet is gone.";
    return next;
  }
  next.turnPlayerId = opponentId;
  return next;
}

function view(state: BattleshipState, playerId: string): BattleshipView {
  const opponentId = otherPlayer(state, playerId);
  const yourFleet = (state.fleets[playerId] ?? []).map(toVisible);
  const opponentFleet =
    state.phase === "finished" ? (state.fleets[opponentId] ?? []).map(toVisible) : null;
  return {
    phase: state.phase,
    yourTurn: state.turnPlayerId === playerId,
    youPlaced: state.locked[playerId] === true,
    opponentPlaced: state.locked[opponentId] === true,
    yourFleet,
    yourShots: (state.shots[playerId] ?? []).map((shot) => ({ ...shot })),
    incoming: (state.shots[opponentId] ?? []).map((shot) => ({ ...shot })),
    opponentFleet,
    winnerId: state.winnerId,
    reason: state.reason,
    notice: state.noticeFor[playerId] ?? null,
  };
}

export const battleshipEngine: GameEngine<BattleshipState, BattleshipMove, BattleshipView> = {
  id: "battleship",
  minPlayers: 2,
  maxPlayers: 2,
  createGame,
  validateMove: validate,
  applyMove(state, playerId, move) {
    const check = validate(state, playerId, move);
    if (!check.ok) return state;
    return apply(state, playerId, move);
  },
  getPlayerView: view,
  getOutcome(state) {
    if (state.phase !== "finished" || !state.winnerId || !state.reason) return null;
    return { winnerIds: [state.winnerId], reason: state.reason };
  },
};

export function standardFleet(rowStart = 0): FleetPlacement[] {
  return BATTLESHIP_FLEET.map((ship, index) => ({
    kind: ship.kind,
    r: rowStart + index * 2,
    c: 0,
    dir: "horizontal" as const,
  }));
}
