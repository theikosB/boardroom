import { describe, expect, it } from "vitest";
import { card, dealPoker, pokerEngine, rankHand } from "./engine.ts";

const c = card;

function topFirst(cards: ReturnType<typeof card>[]) {
  return [...cards].reverse();
}

describe("poker hands", () => {
  it("ranks a royal flush above a straight and a wheel above high card", () => {
    const royal = rankHand([
      c("a", "A", "spades"),
      c("k", "K", "spades"),
      c("q", "Q", "spades"),
      c("j", "J", "spades"),
      c("t", "T", "spades"),
    ]);
    const straight = rankHand([
      c("a2", "9", "hearts"),
      c("k2", "8", "clubs"),
      c("q2", "7", "diamonds"),
      c("j2", "6", "hearts"),
      c("t2", "5", "clubs"),
    ]);
    const wheel = rankHand([
      c("w1", "A", "hearts"),
      c("w2", "2", "clubs"),
      c("w3", "3", "diamonds"),
      c("w4", "4", "hearts"),
      c("w5", "5", "clubs"),
    ]);
    const king = rankHand([
      c("h1", "A", "clubs"),
      c("h2", "K", "diamonds"),
      c("h3", "9", "clubs"),
      c("h4", "4", "spades"),
      c("h5", "2", "hearts"),
    ]);
    expect(royal.name).toBe("Royal flush");
    expect(royal.score).toBeGreaterThan(straight.score);
    expect(straight.score).toBeGreaterThan(wheel.score);
    expect(wheel.name).toBe("Straight");
    expect(wheel.score).toBeGreaterThan(king.score);
  });
});

describe("poker engine", () => {
  it("hides the other hole cards and refuses a check into a blind", () => {
    const state = pokerEngine.createGame(["ada", "bea"]);
    const ada = pokerEngine.getPlayerView(state, "ada");
    const bea = pokerEngine.getPlayerView(state, "bea");
    expect(ada.yourHole).toHaveLength(2);
    expect(bea.yourHole).toHaveLength(2);
    expect(ada.pot).toBe(30);
    const raw = JSON.stringify(ada);
    for (const hidden of bea.yourHole) expect(raw).not.toContain(`"id":"${hidden.id}"`);
    expect(raw).not.toContain("deck");
    const checked = pokerEngine.applyMove(state, ada.yourTurn ? "ada" : "bea", { type: "check" });
    expect(checked).toBe(state);
  });

  it("gives the pot to the last player without showing the folded hand", () => {
    const state = dealPoker({
      playerIds: ["ada", "bea"],
      stacks: [1000, 1000],
      deck: topFirst([
        c("a1", "A", "spades"),
        c("b1", "K", "hearts"),
        c("a2", "A", "diamonds"),
        c("b2", "7", "clubs"),
      ]),
    });
    const actor = pokerEngine.getPlayerView(state, "ada").yourTurn ? "ada" : "bea";
    const folded = pokerEngine.applyMove(state, actor, { type: "fold" });
    const winnerId = actor === "ada" ? "bea" : "ada";
    const winner = pokerEngine.getPlayerView(folded, winnerId);
    const loser = pokerEngine.getPlayerView(folded, actor);
    expect(winner.stack).toBe(1010);
    expect(loser.stack).toBe(990);
    expect(winner.street).toBe("showdown");
    expect(JSON.stringify(loser)).not.toContain(winner.yourHole[0]?.id ?? "missing");
    expect(winner.opponents[0]?.hole).toBeNull();
  });

  it("awards a showdown to the better hole cards", () => {
    let state = dealPoker({
      playerIds: ["ada", "bea"],
      stacks: [1000, 1000],
      deck: topFirst([
        c("a1", "A", "spades"),
        c("b1", "7", "clubs"),
        c("a2", "A", "hearts"),
        c("b2", "2", "diamonds"),
        c("f1", "K", "clubs"),
        c("f2", "K", "diamonds"),
        c("f3", "2", "clubs"),
        c("t", "9", "hearts"),
        c("r", "3", "spades"),
      ]),
    });
    expect(pokerEngine.getPlayerView(state, "ada").yourTurn).toBe(true);
    state = pokerEngine.applyMove(state, "ada", { type: "call" });
    state = pokerEngine.applyMove(state, "bea", { type: "check" });
    for (const street of ["flop", "turn", "river"] as const) {
      expect(pokerEngine.getPlayerView(state, "bea").street).toBe(street);
      state = pokerEngine.applyMove(state, "bea", { type: "check" });
      state = pokerEngine.applyMove(state, "ada", { type: "check" });
    }
    const ada = pokerEngine.getPlayerView(state, "ada");
    const bea = pokerEngine.getPlayerView(state, "bea");
    expect(ada.street).toBe("showdown");
    expect(ada.stack).toBe(1020);
    expect(bea.stack).toBe(980);
    expect(ada.yourHandName).toBe("Two pair");
    expect(bea.opponents[0]?.hole?.map((item) => item.id)).toEqual(["a1", "a2"]);
    expect(ada.winners?.[0]?.playerId).toBe("ada");
  });

  it("splits a side pot away from an all-in player", () => {
    let state = dealPoker({
      playerIds: ["ada", "bea", "cam"],
      stacks: [100, 300, 300],
      deck: topFirst([
        c("b1", "K", "spades"),
        c("c1", "Q", "spades"),
        c("a1", "A", "spades"),
        c("b2", "K", "hearts"),
        c("c2", "Q", "hearts"),
        c("a2", "A", "hearts"),
        c("f1", "2", "clubs"),
        c("f2", "3", "diamonds"),
        c("f3", "4", "hearts"),
        c("t", "9", "clubs"),
        c("r", "J", "clubs"),
      ]),
    });
    expect(pokerEngine.getPlayerView(state, "ada").yourTurn).toBe(true);
    state = pokerEngine.applyMove(state, "ada", { type: "bet", amount: 100 });
    state = pokerEngine.applyMove(state, "bea", { type: "bet", amount: 300 });
    state = pokerEngine.applyMove(state, "cam", { type: "call" });
    const ada = pokerEngine.getPlayerView(state, "ada");
    const bea = pokerEngine.getPlayerView(state, "bea");
    const cam = pokerEngine.getPlayerView(state, "cam");
    expect(ada.stack).toBe(300);
    expect(bea.stack).toBe(400);
    expect(cam.stack).toBe(0);
    expect(ada.stack + bea.stack + cam.stack).toBe(700);
    expect(JSON.stringify(ada.opponents)).toContain("b1");
  });

  it("rejects a move from the player who is waiting", () => {
    const state = dealPoker({
      playerIds: ["ada", "bea"],
      stacks: [1000, 1000],
      deck: topFirst([
        c("a1", "A", "spades"),
        c("b1", "K", "hearts"),
        c("a2", "A", "diamonds"),
        c("b2", "7", "clubs"),
      ]),
    });
    expect(pokerEngine.applyMove(state, "bea", { type: "fold" })).toBe(state);
    expect(pokerEngine.applyMove(state, "ada", { type: "bet", amount: 15 })).toBe(state);
  });
});
