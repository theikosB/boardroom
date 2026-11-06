import type { BattleshipUpdate } from "./games/battleship.ts";
import type { PokerView } from "./games/poker.ts";
import type { UnoView } from "./games/uno.ts";

export interface UnoUpdate {
  version: number;
  gameId: "uno";
  view: UnoView;
}

export interface PokerUpdate {
  version: number;
  gameId: "poker";
  view: PokerView;
}

export type GameUpdate = BattleshipUpdate | UnoUpdate | PokerUpdate;
