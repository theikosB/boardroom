export { battleshipEngine } from "./battleship/engine.ts";
export { unoEngine } from "./uno/engine.ts";
import { battleshipEngine } from "./battleship/engine.ts";
import { unoEngine } from "./uno/engine.ts";

/** Playable engines. Coming-soon catalog rows do not get an entry here. */
export const engines = {
  battleship: battleshipEngine,
  uno: unoEngine,
} as const;

export function engineFor(gameId: string) {
  if (gameId === "battleship") return battleshipEngine;
  if (gameId === "uno") return unoEngine;
  return null;
}
