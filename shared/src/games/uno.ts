export const UNO_COLORS = ["red", "yellow", "green", "blue"] as const;

export type UnoColor = (typeof UNO_COLORS)[number];

export const UNO_RANKS = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "skip",
  "reverse",
  "draw2",
  "wild",
  "draw4",
] as const;

export type UnoRank = (typeof UNO_RANKS)[number];

export interface UnoCard {
  id: string;
  color: UnoColor | "wild";
  rank: UnoRank;
}

export type UnoMove =
  | { type: "play"; cardId: string; color?: UnoColor }
  | { type: "draw" }
  | { type: "pass" }
  | { type: "call-uno" }
  | { type: "catch"; playerId: string }
  | { type: "choose-color"; color: UnoColor };

export interface UnoOpponent {
  playerId: string;
  count: number;
  calledUno: boolean;
}

export interface UnoView {
  phase: "playing" | "finished";
  yourHand: UnoCard[];
  opponents: UnoOpponent[];
  discardTop: UnoCard | null;
  activeColor: UnoColor | null;
  yourTurn: boolean;
  needsColor: boolean;
  direction: "clockwise" | "counterclockwise";
  drawCount: number;
  drawnPlayable: boolean;
  mustCallUno: boolean;
  canCatchIds: string[];
  winnerId: string | null;
  reason: string | null;
  notice: string | null;
  revealedHands: { playerId: string; cards: UnoCard[] }[] | null;
}
