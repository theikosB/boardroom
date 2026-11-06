import type { BattleshipUpdate } from "./games/battleship.ts";
import type { UnoView } from "./games/uno.ts";

export interface UnoUpdate {
  version: number;
  gameId: "uno";
  view: UnoView;
}

export type GameUpdate = BattleshipUpdate | UnoUpdate;
