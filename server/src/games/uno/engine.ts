import type { GameEngine, UnoCard, UnoColor, UnoMove, UnoRank, UnoView } from "@boardroom/shared";
import { UNO_COLORS } from "@boardroom/shared";

export interface UnoState {
  phase: "playing" | "finished";
  playerIds: string[];
  hands: Record<string, UnoCard[]>;
  drawPile: UnoCard[];
  discard: UnoCard[];
  activeColor: UnoColor | null;
  turnIndex: number;
  direction: 1 | -1;
  drawnThisTurn: string | null;
  unoVulnerable: string | null;
  unoCalled: Record<string, boolean>;
  winnerId: string | null;
  reason: string | null;
  noticeFor: Record<string, string | null>;
}

const NUMBER_RANKS: UnoRank[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

function mod(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function shuffle<T>(items: readonly T[]): T[] {
  const next = [...items];
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

function buildDeck(): UnoCard[] {
  const cards: UnoCard[] = [];
  let serial = 0;
  const add = (color: UnoCard["color"], rank: UnoRank) => {
    cards.push({ id: `card-${serial}`, color, rank });
    serial += 1;
  };
  for (const color of UNO_COLORS) {
    add(color, "0");
    for (const rank of NUMBER_RANKS.slice(1)) {
      add(color, rank);
      add(color, rank);
    }
    for (const rank of ["skip", "reverse", "draw2"] as const) {
      add(color, rank);
      add(color, rank);
    }
  }
  for (let copy = 0; copy < 4; copy += 1) {
    add("wild", "wild");
    add("wild", "draw4");
  }
  return cards;
}

function topCard(state: UnoState): UnoCard | null {
  return state.discard[state.discard.length - 1] ?? null;
}

function isWild(card: UnoCard): boolean {
  return card.rank === "wild" || card.rank === "draw4";
}

function matches(card: UnoCard, state: UnoState): boolean {
  if (isWild(card)) return true;
  if (state.activeColor && card.color === state.activeColor) return true;
  const top = topCard(state);
  return Boolean(top && !isWild(top) && card.rank === top.rank);
}

function hasActiveColor(hand: readonly UnoCard[], color: UnoColor): boolean {
  return hand.some((card) => card.color === color);
}

function pull(state: UnoState, count: number): UnoCard[] {
  const drawn: UnoCard[] = [];
  for (let index = 0; index < count; index += 1) {
    if (state.drawPile.length === 0) {
      const keep = state.discard.pop();
      state.drawPile = shuffle(state.discard);
      state.discard = keep ? [keep] : [];
    }
    const card = state.drawPile.pop();
    if (!card) break;
    drawn.push(card);
  }
  return drawn;
}

function advance(state: UnoState, steps: number): void {
  state.turnIndex = mod(state.turnIndex + state.direction * steps, state.playerIds.length);
  state.drawnThisTurn = null;
}

function tell(state: UnoState, playerId: string, message: string, others: string): void {
  for (const id of state.playerIds) state.noticeFor[id] = id === playerId ? message : others;
}

function fresh(playerIds: readonly string[]): Pick<UnoState, "unoCalled" | "noticeFor"> {
  const unoCalled: Record<string, boolean> = {};
  const noticeFor: Record<string, string | null> = {};
  for (const id of playerIds) {
    unoCalled[id] = false;
    noticeFor[id] = null;
  }
  return { unoCalled, noticeFor };
}

export function createGame(playerIds: readonly string[]): UnoState {
  if (playerIds.length < 2 || playerIds.length > 10) throw new Error("UNO needs two to ten players.");
  let deck = shuffle(buildDeck());
  const hands: Record<string, UnoCard[]> = {};
  for (const id of playerIds) hands[id] = deck.splice(0, 7);
  let opening = deck.pop();
  if (!opening) throw new Error("The deck ran out before the first card.");
  while (opening.rank === "draw4") {
    deck.push(opening);
    deck = shuffle(deck);
    opening = deck.pop();
    if (!opening) throw new Error("The deck ran out before the first card.");
  }
  const blank = fresh(playerIds);
  const state: UnoState = {
    phase: "playing",
    playerIds: [...playerIds],
    hands,
    drawPile: deck,
    discard: [opening],
    activeColor: opening.color === "wild" ? null : opening.color,
    turnIndex: 1 % playerIds.length,
    direction: 1,
    drawnThisTurn: null,
    unoVulnerable: null,
    winnerId: null,
    reason: null,
    ...blank,
  };
  if (opening.rank === "reverse") {
    state.direction = -1;
    state.turnIndex = playerIds.length === 2 ? 0 : playerIds.length - 1;
    tell(state, state.playerIds[state.turnIndex] ?? "", "Your turn.", "Play reverses.");
  } else if (opening.rank === "skip") {
    state.turnIndex = 2 % playerIds.length;
    tell(state, state.playerIds[state.turnIndex] ?? "", "Your turn.", "The first player was skipped.");
  } else if (opening.rank === "draw2") {
    const skipped = state.playerIds[1];
    if (skipped) state.hands[skipped]?.push(...pull(state, 2));
    state.turnIndex = 2 % playerIds.length;
    tell(state, skipped ?? "", "You drew two cards.", "The first player drew two cards.");
  } else if (opening.rank === "wild") {
    tell(state, state.playerIds[state.turnIndex] ?? "", "Choose a color.", "A wild card starts the discard pile.");
  } else {
    tell(state, state.playerIds[state.turnIndex] ?? "", "Your turn.", "The discard pile is set.");
  }
  return state;
}

export function dealUno(input: {
  playerIds: string[];
  hands: Record<string, UnoCard[]>;
  discard: UnoCard;
  drawPile: UnoCard[];
  turnId: string;
  color: UnoColor | null;
}): UnoState {
  const blank = fresh(input.playerIds);
  const turnIndex = input.playerIds.indexOf(input.turnId);
  return {
    phase: "playing",
    playerIds: [...input.playerIds],
    hands: structuredClone(input.hands),
    drawPile: [...input.drawPile],
    discard: [input.discard],
    activeColor: input.color,
    turnIndex: turnIndex < 0 ? 0 : turnIndex,
    direction: 1,
    drawnThisTurn: null,
    unoVulnerable: null,
    winnerId: null,
    reason: null,
    ...blank,
  };
}

function validate(state: UnoState, playerId: string, move: UnoMove) {
  if (!state.playerIds.includes(playerId)) return { ok: false as const, reason: "You are not seated in this match." };
  if (state.phase === "finished") return { ok: false as const, reason: "This match is over." };
  const current = state.playerIds[state.turnIndex];
  if (move.type === "call-uno") {
    if ((state.hands[playerId]?.length ?? 0) !== 1) return { ok: false as const, reason: "Call UNO when you have one card." };
    return { ok: true as const };
  }
  if (move.type === "catch") {
    if (move.playerId === playerId) return { ok: false as const, reason: "You cannot catch yourself." };
    if (state.unoVulnerable !== move.playerId) return { ok: false as const, reason: "That player called UNO in time." };
    return { ok: true as const };
  }
  if (current !== playerId) return { ok: false as const, reason: "Wait for your turn." };
  if (move.type === "choose-color") {
    if (state.activeColor) return { ok: false as const, reason: "The color is already chosen." };
    return { ok: true as const };
  }
  if (!state.activeColor) return { ok: false as const, reason: "Choose a color first." };
  if (move.type === "pass") {
    if (!state.drawnThisTurn) return { ok: false as const, reason: "Draw a card before you pass." };
    return { ok: true as const };
  }
  if (move.type === "draw") {
    if (state.drawnThisTurn) return { ok: false as const, reason: "You already drew a card." };
    return { ok: true as const };
  }
  const hand = state.hands[playerId] ?? [];
  const card = hand.find((item) => item.id === move.cardId);
  if (!card) return { ok: false as const, reason: "That card is not in your hand." };
  if (state.drawnThisTurn && state.drawnThisTurn !== card.id) {
    return { ok: false as const, reason: "Play the card you drew, or pass." };
  }
  if (!matches(card, state)) return { ok: false as const, reason: "That card does not match." };
  if (card.rank === "draw4" && state.activeColor && hasActiveColor(hand, state.activeColor)) {
    return { ok: false as const, reason: "You still have a card of the current color." };
  }
  if (isWild(card) && !move.color) return { ok: false as const, reason: "Choose a color." };
  return { ok: true as const };
}

function apply(state: UnoState, playerId: string, move: UnoMove): UnoState {
  const next = structuredClone(state);
  if (move.type === "call-uno") {
    next.unoCalled[playerId] = true;
    if (next.unoVulnerable === playerId) next.unoVulnerable = null;
    tell(next, playerId, "You called UNO.", "UNO.");
    return next;
  }
  if (move.type === "catch") {
    const caught = move.playerId;
    next.hands[caught] = [...(next.hands[caught] ?? []), ...pull(next, 2)];
    next.unoCalled[caught] = false;
    next.unoVulnerable = null;
    tell(next, caught, "You were caught and drew two cards.", "Someone forgot to call UNO.");
    return next;
  }
  if (next.unoVulnerable && next.unoVulnerable !== playerId) next.unoVulnerable = null;
  if (move.type === "choose-color") {
    next.activeColor = move.color;
    tell(next, playerId, `Color set to ${move.color}.`, `The color is ${move.color}.`);
    return next;
  }
  if (move.type === "pass") {
    advance(next, 1);
    tell(next, playerId, "You passed.", "The turn passed.");
    return next;
  }
  if (move.type === "draw") {
    const [card] = pull(next, 1);
    if (!card) {
      advance(next, 1);
      tell(next, playerId, "The deck is empty.", "The deck is empty.");
      return next;
    }
    next.hands[playerId] = [...(next.hands[playerId] ?? []), card];
    if (!matches(card, next)) {
      advance(next, 1);
      tell(next, playerId, "You drew a card.", "A card was drawn.");
      return next;
    }
    next.drawnThisTurn = card.id;
    tell(next, playerId, "That card can be played.", "A card was drawn.");
    return next;
  }
  const hand = next.hands[playerId] ?? [];
  const card = hand.find((item) => item.id === move.cardId);
  if (!card) return state;
  next.hands[playerId] = hand.filter((item) => item.id !== card.id);
  next.discard.push(card);
  next.drawnThisTurn = null;
  if (isWild(card) && move.color) next.activeColor = move.color;
  else if (!isWild(card) && card.color !== "wild") next.activeColor = card.color;
  const remaining = next.hands[playerId]?.length ?? 0;
  if (remaining === 1) {
    next.unoCalled[playerId] = false;
    next.unoVulnerable = playerId;
  }
  if (card.rank === "reverse") {
    next.direction = next.direction === 1 ? -1 : 1;
    advance(next, next.playerIds.length === 2 ? 2 : 1);
    tell(next, playerId, "You reversed play.", "Play reversed.");
  } else if (card.rank === "skip") {
    advance(next, 2);
    tell(next, playerId, "You skipped the next player.", "A player was skipped.");
  } else if (card.rank === "draw2" || card.rank === "draw4") {
    const count = card.rank === "draw2" ? 2 : 4;
    const skippedIndex = mod(next.turnIndex + next.direction, next.playerIds.length);
    const skipped = next.playerIds[skippedIndex];
    if (skipped) next.hands[skipped] = [...(next.hands[skipped] ?? []), ...pull(next, count)];
    advance(next, 2);
    tell(next, skipped ?? playerId, `You drew ${count} cards.`, `A player drew ${count} cards.`);
  } else {
    advance(next, 1);
    tell(next, playerId, "Card played.", "A card was played.");
  }
  if (remaining === 0) {
    next.phase = "finished";
    next.winnerId = playerId;
    next.reason = "A player emptied their hand.";
    next.unoVulnerable = null;
    tell(next, playerId, "You went out.", "The hand is empty.");
  }
  return next;
}

function view(state: UnoState, playerId: string): UnoView {
  const current = state.playerIds[state.turnIndex];
  const opponents = state.playerIds
    .filter((id) => id !== playerId)
    .map((id) => ({
      playerId: id,
      count: state.hands[id]?.length ?? 0,
      calledUno: state.unoCalled[id] === true,
    }));
  return {
    phase: state.phase,
    yourHand: (state.hands[playerId] ?? []).map((card) => ({ ...card })),
    opponents,
    discardTop: topCard(state) ? { ...topCard(state)! } : null,
    activeColor: state.activeColor,
    yourTurn: current === playerId && state.phase === "playing",
    needsColor: state.activeColor === null && current === playerId && state.phase === "playing",
    direction: state.direction === 1 ? "clockwise" : "counterclockwise",
    drawCount: state.drawPile.length,
    drawnPlayable: state.drawnThisTurn !== null && current === playerId,
    mustCallUno: state.unoVulnerable === playerId,
    canCatchIds: state.unoVulnerable && state.unoVulnerable !== playerId ? [state.unoVulnerable] : [],
    winnerId: state.winnerId,
    reason: state.reason,
    notice: state.noticeFor[playerId] ?? null,
    revealedHands:
      state.phase === "finished"
        ? state.playerIds.map((id) => ({
            playerId: id,
            cards: (state.hands[id] ?? []).map((card) => ({ ...card })),
          }))
        : null,
  };
}

export function dropPlayer(state: UnoState, leaverId: string): UnoState {
  const next = structuredClone(state);
  if (next.phase === "finished") return next;
  const winner = next.playerIds.find((id) => id !== leaverId) ?? null;
  if (next.playerIds.length <= 2) {
    next.phase = "finished";
    next.winnerId = winner;
    next.reason = "The other player left the table.";
    next.unoVulnerable = null;
    if (winner) next.noticeFor[winner] = "The other player left.";
    return next;
  }
  const index = next.playerIds.indexOf(leaverId);
  const turnId = next.playerIds[next.turnIndex];
  next.playerIds = next.playerIds.filter((id) => id !== leaverId);
  delete next.hands[leaverId];
  delete next.unoCalled[leaverId];
  delete next.noticeFor[leaverId];
  if (next.unoVulnerable === leaverId) next.unoVulnerable = null;
  if (turnId === leaverId) {
    next.turnIndex =
      next.direction === 1 ? index % next.playerIds.length : mod(index - 1, next.playerIds.length);
  } else {
    next.turnIndex = Math.max(0, next.playerIds.indexOf(turnId ?? ""));
  }
  return next;
}

export function endByHost(state: UnoState): UnoState {
  const next = structuredClone(state);
  next.phase = "finished";
  next.winnerId = null;
  next.reason = "The host ended the match.";
  next.unoVulnerable = null;
  for (const id of next.playerIds) next.noticeFor[id] = "The host ended the match.";
  return next;
}

export const unoEngine: GameEngine<UnoState, UnoMove, UnoView> = {
  id: "uno",
  minPlayers: 2,
  maxPlayers: 10,
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
