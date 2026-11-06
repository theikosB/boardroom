export const POKER_RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;

export type PokerRank = (typeof POKER_RANKS)[number];

export const POKER_SUITS = ["clubs", "diamonds", "hearts", "spades"] as const;

export type PokerSuit = (typeof POKER_SUITS)[number];

export interface PokerCard {
  id: string;
  rank: PokerRank;
  suit: PokerSuit;
}

export type PokerStreet = "preflop" | "flop" | "turn" | "river" | "showdown";

export type PokerMove =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  | { type: "bet"; amount: number }
  | { type: "deal" };

export interface PokerOpponent {
  playerId: string;
  stack: number;
  bet: number;
  folded: boolean;
  allIn: boolean;
  isButton: boolean;
  hole: PokerCard[] | null;
}

export interface PokerWinner {
  playerId: string;
  amount: number;
  handName: string;
}

export interface PokerView {
  phase: "playing" | "finished";
  street: PokerStreet;
  yourTurn: boolean;
  yourHole: PokerCard[];
  board: PokerCard[];
  pot: number;
  stack: number;
  yourBet: number;
  toCall: number;
  canCheck: boolean;
  canCall: boolean;
  canBet: boolean;
  canRaise: boolean;
  minAmount: number | null;
  maxAmount: number;
  opponents: PokerOpponent[];
  winners: PokerWinner[] | null;
  yourHandName: string | null;
  canDeal: boolean;
  notice: string | null;
  winnerId: string | null;
  reason: string | null;
}
