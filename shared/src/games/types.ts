import type { GameId } from "../catalog.ts";

export interface MoveRejection {
  ok: false;
  reason: string;
}

export interface MoveAccepted {
  ok: true;
}

export type MoveValidation = MoveAccepted | MoveRejection;

export interface GameOutcome {
  winnerIds: readonly string[];
  reason: string;
}

/**
 * Server-side contract for a playable game.
 *
 * Implementations live in the server package (added with rooms), never in
 * React. `getPlayerView` is the only game state a browser may receive.
 * `getOutcome` is how the server names a winner. The client displays that
 * result and does not compute its own.
 *
 * Battleship is the first implementation. It lives in the server package.
 * See docs/adding-a-game.md.
 */
export interface GameEngine<TState, TMove, TView> {
  readonly id: GameId;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  createGame(playerIds: readonly string[]): TState;
  validateMove(state: TState, playerId: string, move: TMove): MoveValidation;
  applyMove(state: TState, playerId: string, move: TMove): TState;
  getPlayerView(state: TState, playerId: string): TView;
  getOutcome(state: TState): GameOutcome | null;
}
