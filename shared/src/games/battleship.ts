export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const BATTLESHIP_FLEET = [
  { kind: "carrier", name: "Carrier", length: 5 },
  { kind: "battleship", name: "Battleship", length: 4 },
  { kind: "cruiser", name: "Cruiser", length: 3 },
  { kind: "submarine", name: "Submarine", length: 3 },
  { kind: "destroyer", name: "Destroyer", length: 2 },
] as const;

export type ShipKind = (typeof BATTLESHIP_FLEET)[number]["kind"];
export type ShipDirection = "horizontal" | "vertical";

export interface Coord {
  r: number;
  c: number;
}

export interface FleetPlacement {
  kind: ShipKind;
  r: number;
  c: number;
  dir: ShipDirection;
}

export type BattleshipMove =
  | { type: "place"; ships: FleetPlacement[] }
  | { type: "fire"; r: number; c: number };

export interface VisibleShip {
  kind: ShipKind;
  cells: Coord[];
  hits: number;
}

export interface CellMark {
  r: number;
  c: number;
  result: "miss" | "hit" | "sunk";
  sunkKind?: ShipKind;
}

/** Everything one player is allowed to see. Opponent ships stay out until the match is over. */
export interface BattleshipView {
  phase: "placement" | "battle" | "finished";
  yourTurn: boolean;
  youPlaced: boolean;
  opponentPlaced: boolean;
  yourFleet: VisibleShip[];
  yourShots: CellMark[];
  incoming: CellMark[];
  opponentFleet: VisibleShip[] | null;
  winnerId: string | null;
  reason: string | null;
  notice: string | null;
}

export interface BattleshipUpdate {
  version: number;
  gameId: "battleship";
  view: BattleshipView;
}

export interface PublicPlayer {
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  isHost: boolean;
  wantsRematch: boolean;
}

export interface PublicRoom {
  code: string;
  phase: "lobby" | "playing" | "finished";
  gameId: "battleship" | "uno" | null;
  hostId: string;
  players: PublicPlayer[];
  version: number;
}

export interface SeatSession {
  code: string;
  playerId: string;
  token: string;
  name: string;
}

export type ClientAck =
  | { ok: true; session?: SeatSession }
  | { ok: false; message: string };
