import {
  battleshipMoveSchema,
  unoMoveSchema,
  type GameUpdate,
  type PlayableGameId,
} from "@boardroom/shared";
import { battleshipEngine, endByHost as endBattleship, forfeit, type BattleshipState } from "./battleship/engine.ts";
import { dropPlayer, endByHost as endUno, unoEngine, type UnoState } from "./uno/engine.ts";

export type Match = { id: "battleship"; state: BattleshipState } | { id: "uno"; state: UnoState };

export function createMatch(gameId: PlayableGameId, playerIds: readonly string[]): Match {
  if (gameId === "uno") return { id: "uno", state: unoEngine.createGame(playerIds) };
  return { id: "battleship", state: battleshipEngine.createGame(playerIds) };
}

export function seatedIds(match: Match): readonly string[] {
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
  const parsed = unoMoveSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "That move is not valid." };
  const check = unoEngine.validateMove(match.state, playerId, parsed.data);
  if (!check.ok) return { ok: false, message: check.reason };
  const state = unoEngine.applyMove(match.state, playerId, parsed.data);
  return { ok: true, match: { id: "uno", state }, finished: unoEngine.getOutcome(state) !== null };
}

export function viewUpdate(match: Match, playerId: string): GameUpdate {
  if (match.id === "battleship") {
    return { version: 0, gameId: "battleship", view: battleshipEngine.getPlayerView(match.state, playerId) };
  }
  return { version: 0, gameId: "uno", view: unoEngine.getPlayerView(match.state, playerId) };
}

export function finishByHost(match: Match): Match {
  if (match.id === "battleship") return { id: "battleship", state: endBattleship(match.state) };
  return { id: "uno", state: endUno(match.state) };
}

export function playerLeft(match: Match, playerId: string): { match: Match; finished: boolean } {
  if (match.id === "battleship") {
    return { match: { id: "battleship", state: forfeit(match.state, playerId) }, finished: true };
  }
  const state = dropPlayer(match.state, playerId);
  return { match: { id: "uno", state }, finished: state.phase === "finished" };
}
