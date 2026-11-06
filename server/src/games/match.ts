import { battleshipMoveSchema, pokerMoveSchema, unoMoveSchema, type GameUpdate, type PlayableGameId } from "@boardroom/shared";
import { battleshipEngine, endByHost as endBattleship, forfeit, type BattleshipState } from "./battleship/engine.ts";
import { dropPlayer as dropPoker, endByHost as endPoker, pokerEngine, type PokerState } from "./poker/engine.ts";
import { dropPlayer, endByHost as endUno, unoEngine, type UnoState } from "./uno/engine.ts";

export type Match =
  | { id: "battleship"; state: BattleshipState }
  | { id: "uno"; state: UnoState }
  | { id: "poker"; state: PokerState };

export function createMatch(gameId: PlayableGameId, playerIds: readonly string[]): Match {
  if (gameId === "uno") return { id: "uno", state: unoEngine.createGame(playerIds) };
  if (gameId === "poker") return { id: "poker", state: pokerEngine.createGame(playerIds) };
  return { id: "battleship", state: battleshipEngine.createGame(playerIds) };
}

export function seatedIds(match: Match): readonly string[] {
  if (match.id === "poker") return match.state.seats.map((seat) => seat.playerId);
  return match.state.playerIds;
}

export function submitMove(
  match: Match,
  playerId: string,
  raw: unknown,
): { ok: true; match: Match; finished: boolean } | { ok: false; message: string } {
  if (match.id === "battleship") {
    const parsed = battleshipMoveSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, message: "That move is not valid." };
    const check = battleshipEngine.validateMove(match.state, playerId, parsed.data);
    if (!check.ok) return { ok: false, message: check.reason };
    const state = battleshipEngine.applyMove(match.state, playerId, parsed.data);
    return {
      ok: true,
      match: { id: "battleship", state },
      finished: battleshipEngine.getOutcome(state) !== null,
    };
  }
  if (match.id === "uno") {
    const parsed = unoMoveSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, message: "That move is not valid." };
    const check = unoEngine.validateMove(match.state, playerId, parsed.data);
    if (!check.ok) return { ok: false, message: check.reason };
    const state = unoEngine.applyMove(match.state, playerId, parsed.data);
    return { ok: true, match: { id: "uno", state }, finished: unoEngine.getOutcome(state) !== null };
  }
  const parsed = pokerMoveSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "That move is not valid." };
  const check = pokerEngine.validateMove(match.state, playerId, parsed.data);
  if (!check.ok) return { ok: false, message: check.reason };
  const state = pokerEngine.applyMove(match.state, playerId, parsed.data);
  return { ok: true, match: { id: "poker", state }, finished: pokerEngine.getOutcome(state) !== null };
}

export function viewUpdate(match: Match, playerId: string): GameUpdate {
  if (match.id === "battleship") {
    return { version: 0, gameId: "battleship", view: battleshipEngine.getPlayerView(match.state, playerId) };
  }
  if (match.id === "uno") return { version: 0, gameId: "uno", view: unoEngine.getPlayerView(match.state, playerId) };
  return { version: 0, gameId: "poker", view: pokerEngine.getPlayerView(match.state, playerId) };
}

export function finishByHost(match: Match): Match {
  if (match.id === "battleship") return { id: "battleship", state: endBattleship(match.state) };
  if (match.id === "uno") return { id: "uno", state: endUno(match.state) };
  return { id: "poker", state: endPoker(match.state) };
}

export function playerLeft(match: Match, playerId: string): { match: Match; finished: boolean } {
  if (match.id === "battleship") {
    return { match: { id: "battleship", state: forfeit(match.state, playerId) }, finished: true };
  }
  if (match.id === "uno") {
    const state = dropPlayer(match.state, playerId);
    return { match: { id: "uno", state }, finished: state.phase === "finished" };
  }
  const state = dropPoker(match.state, playerId);
  return { match: { id: "poker", state }, finished: state.phase === "finished" };
}
