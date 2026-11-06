import { describe, expect, it } from "vitest";
import type { UnoCard } from "@boardroom/shared";
import { dealUno, unoEngine, type UnoState } from "./engine.ts";

function card(id: string, color: UnoCard["color"], rank: UnoCard["rank"]): UnoCard {
  return { id, color, rank };
}

function handsOf(state: UnoState, playerId: string): UnoCard[] {
  return state.hands[playerId] ?? [];
}

describe("uno engine", () => {
  it("plays a matching card and rejects a mismatch or a move out of turn", () => {
    const state = dealUno({
      playerIds: ["ada", "bea"],
      hands: {
        ada: [card("a-red-5", "red", "5"), card("a-blue-1", "blue", "1")],
        bea: [card("b-green-9", "green", "9")],
      },
      discard: card("top-red-2", "red", "2"),
      drawPile: [card("pile-1", "yellow", "3")],
      turnId: "ada",
      color: "red",
    });
    const played = unoEngine.applyMove(state, "ada", { type: "play", cardId: "a-red-5" });
    const mismatch = unoEngine.applyMove(state, "ada", { type: "play", cardId: "a-blue-1" });
    const early = unoEngine.applyMove(state, "bea", { type: "play", cardId: "b-green-9" });
    expect(handsOf(played, "ada").map((item) => item.id)).toEqual(["a-blue-1"]);
    expect(played.playerIds[played.turnIndex]).toBe("bea");
    expect(mismatch).toBe(state);
    expect(early).toBe(state);
    expect(unoEngine.validateMove(state, "bea", { type: "play", cardId: "b-green-9" }).ok).toBe(false);
  });

  it("makes the next player draw two and skips them", () => {
    const state = dealUno({
      playerIds: ["ada", "bea", "cam"],
      hands: {
        ada: [card("a-draw", "red", "draw2")],
        bea: [card("b-1", "green", "1")],
        cam: [card("c-1", "blue", "1")],
      },
      discard: card("top", "red", "4"),
      drawPile: [card("p1", "yellow", "8"), card("p2", "yellow", "9")],
      turnId: "ada",
      color: "red",
    });
    const next = unoEngine.applyMove(state, "ada", { type: "play", cardId: "a-draw" });
    expect(handsOf(next, "bea")).toHaveLength(3);
    expect(next.playerIds[next.turnIndex]).toBe("cam");
  });

  it("names the player who empties a hand", () => {
    const state = dealUno({
      playerIds: ["ada", "bea"],
      hands: {
        ada: [card("a-last", "red", "7")],
        bea: [card("b-1", "blue", "1"), card("b-2", "blue", "2")],
      },
      discard: card("top", "red", "1"),
      drawPile: [card("p1", "yellow", "3")],
      turnId: "ada",
      color: "red",
    });
    const next = unoEngine.applyMove(state, "ada", { type: "play", cardId: "a-last" });
    expect(unoEngine.getOutcome(next)?.winnerIds).toEqual(["ada"]);
    const bea = unoEngine.getPlayerView(next, "bea");
    expect(bea.revealedHands?.find((hand) => hand.playerId === "ada")?.cards).toEqual([]);
  });

  it("hides the other hand and the draw pile until the match ends", () => {
    const state = dealUno({
      playerIds: ["ada", "bea"],
      hands: {
        ada: [card("a-secret", "red", "5"), card("a-other", "blue", "8")],
        bea: [card("b-secret", "green", "9"), card("b-other", "yellow", "4")],
      },
      discard: card("top-visible", "red", "2"),
      drawPile: [card("pile-secret", "blue", "3"), card("pile-secret-2", "green", "6")],
      turnId: "ada",
      color: "red",
    });
    const ada = unoEngine.getPlayerView(state, "ada");
    const raw = JSON.stringify(ada);
    expect(ada.revealedHands).toBeNull();
    expect(raw).not.toContain("b-secret");
    expect(raw).not.toContain("b-other");
    expect(raw).not.toContain("pile-secret");
    expect(raw).toContain("a-secret");
    expect(raw).toContain("top-visible");
    const played = unoEngine.applyMove(state, "ada", { type: "play", cardId: "a-secret" });
    const bea = unoEngine.getPlayerView(played, "bea");
    expect(JSON.stringify(bea)).not.toContain("a-other");
    expect(bea.canCatchIds).toEqual(["ada"]);
  });

  it("deals seven cards and never shows another player's cards", () => {
    const state = unoEngine.createGame(["ada", "bea", "cam"]);
    const ada = unoEngine.getPlayerView(state, "ada");
    expect(ada.yourHand).toHaveLength(7);
    expect(ada.opponents.map((opponent) => opponent.count)).toEqual([7, 7]);
    const hidden = [
      ...(state.hands.bea ?? []),
      ...(state.hands.cam ?? []),
      ...state.drawPile,
    ].map((item) => item.id);
    const raw = JSON.stringify(ada);
    for (const id of hidden) {
      if (id === ada.discardTop?.id) continue;
      expect(raw).not.toContain(`"id":"${id}"`);
    }
  });
});
