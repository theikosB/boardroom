import type { GameEngine, PokerCard, PokerMove, PokerRank, PokerSuit, PokerView } from "@boardroom/shared";
import { POKER_RANKS, POKER_SUITS } from "@boardroom/shared";

export const STARTING_STACK = 1000;
export const SMALL_BLIND = 10;
export const BIG_BLIND = 20;

export interface PokerSeat {
  playerId: string;
  stack: number;
  hole: PokerCard[] | null;
  bet: number;
  handCommit: number;
  folded: boolean;
  allIn: boolean;
}

export interface PokerWinnerShare {
  playerId: string;
  amount: number;
  handName: string;
}

export interface PokerState {
  phase: "playing" | "finished";
  seats: PokerSeat[];
  button: number;
  deck: PokerCard[];
  board: PokerCard[];
  street: PokerView["street"];
  currentBet: number;
  minRaise: number;
  pending: boolean[];
  toAct: number | null;
  handsPlayed: number;
  winners: PokerWinnerShare[] | null;
  revealed: boolean;
  noticeFor: Record<string, string | null>;
  winnerId: string | null;
  reason: string | null;
}

const RANK_VALUE: Record<PokerRank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

export function card(id: string, rank: PokerRank, suit: PokerSuit): PokerCard {
  return { id, rank, suit };
}

function buildDeck(): PokerCard[] {
  const cards: PokerCard[] = [];
  let serial = 0;
  for (const suit of POKER_SUITS) {
    for (const rank of POKER_RANKS) {
      cards.push({ id: `card-${serial}`, rank, suit });
      serial += 1;
    }
  }
  return cards;
}

function shuffle(cards: readonly PokerCard[]): PokerCard[] {
  const next = [...cards];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = next[index];
    const other = next[swap];
    if (current === undefined || other === undefined) continue;
    next[index] = other;
    next[swap] = current;
  }
  return next;
}

function blank(playerIds: readonly string[], stacks: readonly number[], button: number): PokerState {
  const noticeFor: Record<string, string | null> = {};
  const seats = playerIds.map((playerId, index) => {
    noticeFor[playerId] = null;
    return {
      playerId,
      stack: stacks[index] ?? STARTING_STACK,
      hole: null,
      bet: 0,
      handCommit: 0,
      folded: false,
      allIn: false,
    };
  });
  return {
    phase: "playing",
    seats,
    button,
    deck: [],
    board: [],
    street: "preflop",
    currentBet: 0,
    minRaise: BIG_BLIND,
    pending: seats.map(() => false),
    toAct: null,
    handsPlayed: 0,
    winners: null,
    revealed: false,
    noticeFor,
    winnerId: null,
    reason: null,
  };
}

function liveIndexes(state: PokerState): number[] {
  return state.seats.flatMap((seat, index) => (seat.stack > 0 ? [index] : []));
}

function leftAmong(state: PokerState, from: number, candidates: readonly number[]): number {
  for (let step = 1; step <= state.seats.length; step += 1) {
    const index = (from + step) % state.seats.length;
    if (candidates.includes(index)) return index;
  }
  return from;
}

function nextPending(state: PokerState, from: number): number | null {
  for (let step = 1; step <= state.seats.length; step += 1) {
    const index = (from + step) % state.seats.length;
    if (state.pending[index]) return index;
  }
  return null;
}

function draw(state: PokerState, count: number): PokerCard[] {
  const cards: PokerCard[] = [];
  for (let index = 0; index < count; index += 1) {
    const card = state.deck.pop();
    if (!card) break;
    cards.push(card);
  }
  return cards;
}

function post(seat: PokerSeat, amount: number): void {
  const pay = Math.min(amount, seat.stack);
  seat.stack -= pay;
  seat.bet += pay;
  seat.handCommit += pay;
  if (seat.stack === 0) seat.allIn = true;
}

function canAct(seat: PokerSeat): boolean {
  return Boolean(seat.hole) && !seat.folded && !seat.allIn && seat.stack > 0;
}

function tell(state: PokerState, playerId: string, self: string, others: string): void {
  for (const seat of state.seats) state.noticeFor[seat.playerId] = seat.playerId === playerId ? self : others;
}

function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [head, ...rest] = items;
  if (head === undefined) return [];
  return [...combinations(rest, size - 1).map((combo) => [head, ...combo]), ...combinations(rest, size)];
}

export function rankHand(cards: readonly PokerCard[]): { score: number; name: string } {
  const pools = cards.length === 5 ? [cards] : combinations(cards, 5);
  let best = scoreFive(pools[0] ?? []);
  for (const pool of pools.slice(1)) {
    const next = scoreFive(pool);
    if (next.score > best.score) best = next;
  }
  return best;
}

function scoreFive(cards: readonly PokerCard[]): { score: number; name: string } {
  const ranks = cards.map((item) => RANK_VALUE[item.rank]).sort((left, right) => right - left);
  const flush = cards.length === 5 && cards.every((item) => item.suit === cards[0]?.suit);
  const counts = new Map<number, number>();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  const groups = [...counts.entries()].sort((left, right) => right[1] - left[1] || right[0] - left[0]);
  const straightHigh = straightTop([...new Set(ranks)]);
  const primary = groups[0]?.[0] ?? 0;
  const secondary = groups[1]?.[0] ?? 0;
  let category = 0;
  let name = "High card";
  let kickers = ranks;

  if (flush && straightHigh) {
    category = 8;
    name = straightHigh === 14 ? "Royal flush" : "Straight flush";
    kickers = [straightHigh];
  } else if (groups[0]?.[1] === 4) {
    category = 7;
    name = "Four of a kind";
    kickers = [primary, secondary];
  } else if (groups[0]?.[1] === 3 && groups[1]?.[1] === 2) {
    category = 6;
    name = "Full house";
    kickers = [primary, secondary];
  } else if (flush) {
    category = 5;
    name = "Flush";
    kickers = ranks;
  } else if (straightHigh) {
    category = 4;
    name = "Straight";
    kickers = [straightHigh];
  } else if (groups[0]?.[1] === 3) {
    category = 3;
    name = "Three of a kind";
    kickers = groups.map(([rank]) => rank);
  } else if (groups[0]?.[1] === 2 && groups[1]?.[1] === 2) {
    category = 2;
    name = "Two pair";
    const pairs = groups.filter((group) => group[1] === 2).map((group) => group[0]).sort((left, right) => right - left);
    const kicker = groups.find((group) => group[1] === 1)?.[0] ?? 0;
    kickers = [...pairs, kicker];
  } else if (groups[0]?.[1] === 2) {
    category = 1;
    name = "Pair";
    kickers = groups.map(([rank]) => rank);
  }

  const slots = [0, 0, 0, 0, 0];
  kickers.slice(0, 5).forEach((value, index) => {
    slots[index] = value;
  });
  const score = slots.reduce((total, value) => total * 15 + value, category);
  return { score, name };
}

function straightTop(uniqueDesc: readonly number[]): number {
  for (let index = 0; index <= uniqueDesc.length - 5; index += 1) {
    const top = uniqueDesc[index] ?? 0;
    const bottom = uniqueDesc[index + 4] ?? 0;
    if (top - bottom === 4) return top;
  }
  if ([14, 5, 4, 3, 2].every((rank) => uniqueDesc.includes(rank))) return 5;
  return 0;
}

function contenders(state: PokerState): PokerSeat[] {
  return state.seats.filter((seat) => seat.hole && !seat.folded);
}

function awardPots(state: PokerState): void {
  const left = state.seats.map((seat) => seat.handCommit);
  const folded = state.seats.map((seat) => seat.folded);
  const stillIn = contenders(state);
  const winners: PokerWinnerShare[] = [];
  if (stillIn.length <= 1) {
    const amount = left.reduce((sum, value) => sum + value, 0);
    const winner = stillIn[0];
    if (winner && amount > 0) {
      winner.stack += amount;
      winners.push({ playerId: winner.playerId, amount, handName: "Took the pot" });
      tell(state, winner.playerId, "You took the pot.", "The pot was taken.");
    }
  } else {
    state.revealed = true;
    while (state.board.length < 5) {
      const [next] = draw(state, 1);
      if (!next) break;
      state.board.push(next);
    }
    const scored = new Map(stillIn.map((seat) => [seat.playerId, rankHand([...(seat.hole ?? []), ...state.board])]));
    while (left.some((value) => value > 0)) {
      const involved = left.flatMap((value, index) => (value > 0 ? [index] : []));
      const level = Math.min(...involved.map((index) => left[index] ?? 0));
      let pot = 0;
      for (const index of involved) {
        left[index] = (left[index] ?? 0) - level;
        pot += level;
      }
      const eligible = involved.filter((index) => !folded[index]).map((index) => state.seats[index]).filter((seat) => seat !== undefined);
      if (eligible.length === 0 || pot === 0) continue;
      const best = Math.max(...eligible.map((seat) => scored.get(seat.playerId)?.score ?? 0));
      const took = eligible.filter((seat) => (scored.get(seat.playerId)?.score ?? 0) === best);
      const share = Math.floor(pot / took.length);
      let remainder = pot - share * took.length;
      const ordered = [...took].sort((leftSeat, rightSeat) => seatOrder(state, leftSeat) - seatOrder(state, rightSeat));
      for (const seat of ordered) {
        const extra = remainder > 0 ? 1 : 0;
        remainder -= extra;
        const gain = share + extra;
        seat.stack += gain;
        const name = scored.get(seat.playerId)?.name ?? "High card";
        const existing = winners.find((winner) => winner.playerId === seat.playerId);
        if (existing) existing.amount += gain;
        else winners.push({ playerId: seat.playerId, amount: gain, handName: name });
      }
    }
    const lead = winners[0];
    if (lead) tell(state, lead.playerId, `You won with ${lead.handName}.`, `${lead.handName} won the hand.`);
  }
  for (const seat of state.seats) {
    seat.bet = 0;
    seat.handCommit = 0;
    seat.allIn = false;
  }
  state.street = "showdown";
  state.toAct = null;
  state.pending = state.seats.map(() => false);
  state.currentBet = 0;
  state.winners = winners;
  const alive = state.seats.filter((seat) => seat.stack > 0);
  if (alive.length < 2) {
    state.phase = "finished";
    state.winnerId = alive[0]?.playerId ?? null;
    state.reason = "One player has all the chips.";
  }
}

function seatOrder(state: PokerState, seat: PokerSeat): number {
  const index = state.seats.indexOf(seat);
  const distance = (index - state.button + state.seats.length) % state.seats.length;
  return distance === 0 ? state.seats.length : distance;
}

function endStreet(state: PokerState): void {
  for (const seat of state.seats) seat.bet = 0;
  state.currentBet = 0;
  state.minRaise = BIG_BLIND;
  if (contenders(state).length <= 1 || state.street === "river") {
    awardPots(state);
    return;
  }
  const acting = state.seats.some((seat) => canAct(seat));
  if (!acting) {
    awardPots(state);
    return;
  }
  if (state.street === "preflop") {
    state.street = "flop";
    state.board.push(...draw(state, 3));
  } else if (state.street === "flop") {
    state.street = "turn";
    state.board.push(...draw(state, 1));
  } else if (state.street === "turn") {
    state.street = "river";
    state.board.push(...draw(state, 1));
  }
  openBetting(state);
}

function openBetting(state: PokerState): void {
  state.pending = state.seats.map((seat) => canAct(seat));
  state.currentBet = 0;
  state.minRaise = BIG_BLIND;
  if (!state.pending.some(Boolean)) {
    awardPots(state);
    return;
  }
  state.toAct = nextPending(state, state.button);
}

function afterAction(state: PokerState, index: number): void {
  state.pending[index] = false;
  if (contenders(state).length <= 1) {
    awardPots(state);
    return;
  }
  if (!state.pending.some(Boolean)) {
    endStreet(state);
    return;
  }
  state.toAct = nextPending(state, index);
}

function reopen(state: PokerState, raiser: number): void {
  state.pending = state.seats.map((seat, index) => index !== raiser && canAct(seat));
}

function startHand(state: PokerState, shuffleDeck: boolean): PokerState {
  const live = liveIndexes(state);
  if (live.length < 2) {
    state.phase = "finished";
    state.street = "showdown";
    state.winnerId = state.seats[live[0] ?? -1]?.playerId ?? null;
    state.reason = "One player has all the chips.";
    state.toAct = null;
    return state;
  }
  if (state.handsPlayed > 0 || !live.includes(state.button)) state.button = leftAmong(state, state.button, live);
  if (shuffleDeck) state.deck = shuffle(buildDeck());
  state.board = [];
  state.winners = null;
  state.revealed = false;
  state.street = "preflop";
  state.currentBet = 0;
  state.minRaise = BIG_BLIND;
  for (const seat of state.seats) {
    seat.hole = null;
    seat.bet = 0;
    seat.handCommit = 0;
    seat.folded = false;
    seat.allIn = false;
  }
  const order: number[] = [];
  let cursor = live.length === 2 ? state.button : leftAmong(state, state.button, live);
  for (let count = 0; count < live.length; count += 1) {
    order.push(cursor);
    cursor = leftAmong(state, cursor, live);
  }
  const dealt = state.seats.map(() => [] as PokerCard[]);
  for (let round = 0; round < 2; round += 1) {
    for (const index of order) {
      const [next] = draw(state, 1);
      const pile = dealt[index];
      if (next && pile) pile.push(next);
    }
  }
  for (const [index, seat] of state.seats.entries()) {
    const hole = dealt[index] ?? [];
    seat.hole = hole.length === 2 ? hole : null;
  }
  const small = live.length === 2 ? state.button : leftAmong(state, state.button, live);
  const big = leftAmong(state, small, live);
  const smallSeat = state.seats[small];
  const bigSeat = state.seats[big];
  if (smallSeat) post(smallSeat, SMALL_BLIND);
  if (bigSeat) post(bigSeat, BIG_BLIND);
  state.currentBet = Math.max(...state.seats.map((seat) => seat.bet));
  state.pending = state.seats.map((seat) => canAct(seat));
  state.handsPlayed += 1;
  if (!state.pending.some(Boolean)) {
    awardPots(state);
    return state;
  }
  state.toAct = nextPending(state, big);
  const actor = state.seats[state.toAct ?? -1];
  if (actor) tell(state, actor.playerId, "Your turn.", "A new hand is dealt.");
  return state;
}

function pay(seat: PokerSeat, target: number): void {
  const chips = target - seat.bet;
  seat.stack -= chips;
  seat.bet = target;
  seat.handCommit += chips;
  if (seat.stack === 0) seat.allIn = true;
}

function betReason(state: PokerState, seat: PokerSeat, amount: number): string | null {
  const max = seat.bet + seat.stack;
  if (amount > max) return "You do not have those chips.";
  if (amount <= seat.bet) return "That does not put more chips in.";
  if (state.currentBet === 0) {
    const minimum = Math.min(BIG_BLIND, max);
    if (amount < minimum) return `The minimum bet is ${minimum}.`;
    return null;
  }
  if (amount <= state.currentBet) return "A raise has to be higher than the current bet.";
  const full = state.currentBet + state.minRaise;
  if (amount < full && amount !== max) return `The minimum raise is to ${full}.`;
  return null;
}

function validate(state: PokerState, playerId: string, move: PokerMove) {
  const index = state.seats.findIndex((seat) => seat.playerId === playerId);
  const seat = state.seats[index];
  if (!seat) return { ok: false as const, reason: "You are not seated in this match." };
  if (state.phase === "finished") return { ok: false as const, reason: "This match is over." };
  if (move.type === "deal") {
    if (state.street !== "showdown") return { ok: false as const, reason: "The hand is still going." };
    if (seat.stack <= 0) return { ok: false as const, reason: "You are out of chips." };
    return { ok: true as const };
  }
  if (state.street === "showdown" || state.toAct !== index) return { ok: false as const, reason: "Wait for your turn." };
  if (move.type === "fold") return { ok: true as const };
  if (move.type === "check") {
    if (state.currentBet !== seat.bet) return { ok: false as const, reason: "There is a bet to call." };
    return { ok: true as const };
  }
  if (move.type === "call") {
    if (state.currentBet <= seat.bet) return { ok: false as const, reason: "There is nothing to call." };
    return { ok: true as const };
  }
  const reason = betReason(state, seat, move.amount);
  if (reason) return { ok: false as const, reason };
  return { ok: true as const };
}

function apply(state: PokerState, playerId: string, move: PokerMove): PokerState {
  const next = structuredClone(state);
  if (move.type === "deal") return startHand(next, true);
  const index = next.seats.findIndex((seat) => seat.playerId === playerId);
  const seat = next.seats[index];
  if (!seat) return state;
  if (move.type === "fold") {
    seat.folded = true;
    tell(next, playerId, "You folded.", "A player folded.");
  } else if (move.type === "check") {
    tell(next, playerId, "You checked.", "A player checked.");
  } else if (move.type === "call") {
    pay(seat, Math.min(next.currentBet, seat.bet + seat.stack));
    tell(next, playerId, "You called.", "A player called.");
  } else {
    const previous = next.currentBet;
    const raiseSize = move.amount - previous;
    const full = previous === 0 || raiseSize >= next.minRaise;
    pay(seat, move.amount);
    if (previous === 0) next.minRaise = move.amount;
    else if (full) next.minRaise = raiseSize;
    next.currentBet = move.amount;
    if (full) reopen(next, index);
    tell(next, playerId, previous === 0 ? "You bet." : "You raised.", previous === 0 ? "A player bet." : "A player raised.");
  }
  afterAction(next, index);
  return next;
}

function view(state: PokerState, playerId: string): PokerView {
  const index = state.seats.findIndex((seat) => seat.playerId === playerId);
  const seat = state.seats[index];
  const yourTurn = state.phase === "playing" && state.toAct === index && state.street !== "showdown";
  const toCall = seat ? Math.max(0, state.currentBet - seat.bet) : 0;
  const maxAmount = seat ? seat.bet + seat.stack : 0;
  const canBet = Boolean(yourTurn && state.currentBet === 0 && seat && seat.stack > 0);
  const canRaise = Boolean(yourTurn && state.currentBet > 0 && seat && seat.stack > toCall);
  const minimum = state.currentBet === 0 ? Math.min(BIG_BLIND, maxAmount) : Math.min(state.currentBet + state.minRaise, maxAmount);
  const showdown = state.street === "showdown";
  const yourCards = seat?.hole ?? [];
  const scored = showdown && yourCards.length === 2 && state.board.length >= 5 && !seat?.folded
    ? rankHand([...yourCards, ...state.board])
    : null;
  return {
    phase: state.phase,
    street: state.street,
    yourTurn,
    yourHole: yourCards.map((item) => ({ ...item })),
    board: state.board.map((item) => ({ ...item })),
    pot: showdown
      ? (state.winners?.reduce((sum, winner) => sum + winner.amount, 0) ?? 0)
      : state.seats.reduce((sum, item) => sum + item.handCommit, 0),
    stack: seat?.stack ?? 0,
    yourBet: seat?.bet ?? 0,
    toCall,
    canCheck: Boolean(yourTurn && seat && state.currentBet === seat.bet),
    canCall: Boolean(yourTurn && toCall > 0),
    canBet,
    canRaise,
    minAmount: canBet || canRaise ? minimum : null,
    maxAmount,
    opponents: state.seats
      .filter((item) => item.playerId !== playerId)
      .map((item) => ({
        playerId: item.playerId,
        stack: item.stack,
        bet: item.bet,
        folded: item.folded,
        allIn: item.allIn,
        isButton: state.seats[state.button]?.playerId === item.playerId,
        hole: state.revealed && !item.folded && item.hole ? item.hole.map((card) => ({ ...card })) : null,
      })),
    winners: state.winners ? state.winners.map((winner) => ({ ...winner })) : null,
    yourHandName: scored?.name ?? null,
    canDeal: state.phase === "playing" && showdown && (seat?.stack ?? 0) > 0,
    notice: state.noticeFor[playerId] ?? null,
    winnerId: state.winnerId,
    reason: state.reason,
  };
}

export function createGame(playerIds: readonly string[]): PokerState {
  if (playerIds.length < 2 || playerIds.length > 8) throw new Error("Poker needs two to eight players.");
  return startHand(blank(playerIds, playerIds.map(() => STARTING_STACK), 0), true);
}

export function dealPoker(input: {
  playerIds: string[];
  stacks: number[];
  button?: number;
  deck: PokerCard[];
}): PokerState {
  const state = blank(input.playerIds, input.stacks, input.button ?? 0);
  state.deck = [...input.deck];
  return startHand(state, false);
}

export function endByHost(state: PokerState): PokerState {
  const next = structuredClone(state);
  next.phase = "finished";
  next.toAct = null;
  next.pending = next.seats.map(() => false);
  next.winnerId = null;
  next.reason = "The host ended the match.";
  for (const id of Object.keys(next.noticeFor)) next.noticeFor[id] = "The host ended the match.";
  return next;
}

export function dropPlayer(state: PokerState, leaverId: string): PokerState {
  if (state.phase === "finished") return state;
  const next = structuredClone(state);
  const index = next.seats.findIndex((seat) => seat.playerId === leaverId);
  const seat = next.seats[index];
  if (!seat) return state;
  const inHand = Boolean(seat.hole) && !seat.folded && next.street !== "showdown";
  seat.folded = true;
  seat.stack = 0;
  seat.allIn = false;
  if (inHand) {
    next.pending[index] = false;
    if (contenders(next).length <= 1) awardPots(next);
    else if (!next.pending.some(Boolean)) endStreet(next);
    else if (next.toAct === index) next.toAct = nextPending(next, index);
  }
  const alive = next.seats.filter((item) => item.stack > 0);
  if (alive.length < 2 && (next.street === "showdown" || !inHand)) {
    next.phase = "finished";
    next.toAct = null;
    next.winnerId = alive[0]?.playerId ?? null;
    next.reason = "One player has all the chips.";
  }
  return next;
}

export const pokerEngine: GameEngine<PokerState, PokerMove, PokerView> = {
  id: "poker",
  minPlayers: 2,
  maxPlayers: 8,
  createGame,
  validateMove: validate,
  applyMove(state, playerId, move) {
    const check = validate(state, playerId, move);
    if (!check.ok) return state;
    return apply(state, playerId, move);
  },
  getPlayerView: view,
  getOutcome(state) {
    if (state.phase !== "finished" || !state.winnerId || !state.reason) return null;
    return { winnerIds: [state.winnerId], reason: state.reason };
  },
};
