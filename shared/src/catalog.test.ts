import { describe, expect, it } from "vitest";
import {
  GAMES,
  PLAYABLE_GAME_IDS,
  formatDifficulty,
  formatPlayerCount,
} from "./catalog.ts";

const SHELF = [
  "battleship",
  "uno",
  "poker",
  "monopoly",
  "risk",
  "catan",
  "ticket-to-ride",
  "wingspan",
  "splendor",
] as const;

describe("game catalog", () => {
  it("lists the nine games in shelf order", () => {
    expect(GAMES.map((game) => game.id)).toEqual([...SHELF]);
    expect(new Set(SHELF).size).toBe(SHELF.length);
  });

  it("marks a game playable only when it is listed as implemented", () => {
    for (const game of GAMES) {
      const implemented = PLAYABLE_GAME_IDS.includes(game.id);
      expect(game.availability === "playable").toBe(implemented);
    }
    expect(PLAYABLE_GAME_IDS).toEqual([]);
  });

  it("gives every game a description and a legal player range", () => {
    for (const game of GAMES) {
      expect(game.name.trim().length).toBeGreaterThan(0);
      expect(game.description.trim().length).toBeGreaterThan(40);
      expect(game.minPlayers).toBeGreaterThan(0);
      expect(game.maxPlayers).toBeGreaterThanOrEqual(game.minPlayers);
    }
  });
});

describe("formatPlayerCount", () => {
  it("formats a single seat", () => {
    expect(formatPlayerCount(1, 1)).toBe("1 player");
  });

  it("formats a fixed group", () => {
    expect(formatPlayerCount(2, 2)).toBe("2 players");
  });

  it("formats a range", () => {
    expect(formatPlayerCount(3, 4)).toBe("3–4 players");
  });
});

describe("formatDifficulty", () => {
  it("labels each level for the shelf", () => {
    expect(formatDifficulty("easy")).toBe("Easy");
    expect(formatDifficulty("medium")).toBe("Medium");
    expect(formatDifficulty("hard")).toBe("Hard");
  });
});
