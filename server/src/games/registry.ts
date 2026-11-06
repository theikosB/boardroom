export { battleshipEngine } from "./battleship/engine.ts";
import { battleshipEngine } from "./battleship/engine.ts";

/** Playable engines. Coming-soon catalog rows do not get an entry here. */
export const engines = {
  battleship: battleshipEngine,
} as const;

export function engineFor(gameId: string) {
  if (gameId === "battleship") return battleshipEngine;
  return null;
}
