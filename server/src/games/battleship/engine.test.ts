import { describe, expect, it, vi } from "vitest";
import type { BattleshipView, Coord, FleetPlacement } from "@boardroom/shared";
import { BATTLESHIP_FLEET } from "@boardroom/shared";
import { battleshipEngine, standardFleet, type BattleshipState } from "./engine.ts";

function expand(ships: FleetPlacement[]): Coord[] {
  return ships.flatMap((ship) => {
    const length = BATTLESHIP_FLEET.find((entry) => entry.kind === ship.kind)?.length ?? 0;
    return Array.from({ length }, (_, step) => ({
      r: ship.dir === "vertical" ? ship.r + step : ship.r,
      c: ship.dir === "horizontal" ? ship.c + step : ship.c,
    }));
  });
}

function rightSideFleet(): FleetPlacement[] {
  return [
    { kind: "carrier", r: 0, c: 5, dir: "vertical" },
    { kind: "battleship", r: 0, c: 6, dir: "vertical" },
    { kind: "cruiser", r: 0, c: 7, dir: "vertical" },
    { kind: "submarine", r: 0, c: 8, dir: "vertical" },
    { kind: "destroyer", r: 0, c: 9, dir: "vertical" },
  ];
}

function placeBoth(): BattleshipState {
  vi.spyOn(Math, "random").mockReturnValue(0);
  let state = battleshipEngine.createGame(["ada", "bea"]);
  state = battleshipEngine.applyMove(state, "ada", { type: "place", ships: standardFleet() });
  state = battleshipEngine.applyMove(state, "bea", { type: "place", ships: rightSideFleet() });
  return state;
}

function containsCell(view: BattleshipView, r: number, c: number): boolean {
  const cells = [
    ...view.yourFleet.flatMap((ship) => ship.cells),
    ...view.yourShots,
    ...view.incoming,
    ...(view.opponentFleet ?? []).flatMap((ship) => ship.cells),
  ];
  return cells.some((cell) => cell.r === r && cell.c === c);
}

describe("battleship engine", () => {
  it("rejects an overlapping fleet and leaves the state untouched", () => {
    const state = battleshipEngine.createGame(["ada", "bea"]);
    const ships = standardFleet();
    ships[1] = { kind: "battleship", r: 0, c: 0, dir: "horizontal" };
    const check = battleshipEngine.validateMove(state, "ada", { type: "place", ships });
    const next = battleshipEngine.applyMove(state, "ada", { type: "place", ships });
    expect(check.ok).toBe(false);
    expect(next).toBe(state);
  });

  it("lets ships sit on neighboring squares", () => {
    const state = battleshipEngine.createGame(["ada", "bea"]);
    const ships: FleetPlacement[] = [
      { kind: "carrier", r: 0, c: 0, dir: "horizontal" },
      { kind: "battleship", r: 1, c: 0, dir: "horizontal" },
      { kind: "cruiser", r: 2, c: 0, dir: "horizontal" },
      { kind: "submarine", r: 3, c: 0, dir: "horizontal" },
      { kind: "destroyer", r: 4, c: 0, dir: "horizontal" },
    ];
    const next = battleshipEngine.applyMove(state, "ada", { type: "place", ships });
    expect(next.locked.ada).toBe(true);
  });

  it("refuses a second shot at the same square and a shot out of turn", () => {
    const state = placeBoth();
    expect(state.turnPlayerId).toBe("ada");
    const afterHit = battleshipEngine.applyMove(state, "ada", { type: "fire", r: 0, c: 5 });
    const outOfTurn = battleshipEngine.applyMove(afterHit, "ada", { type: "fire", r: 1, c: 5 });
    const answered = battleshipEngine.applyMove(afterHit, "bea", { type: "fire", r: 1, c: 0 });
    const repeat = battleshipEngine.applyMove(answered, "ada", { type: "fire", r: 0, c: 5 });
    expect(afterHit.shots.ada).toHaveLength(1);
    expect(outOfTurn).toBe(afterHit);
    expect(repeat).toBe(answered);
    expect(answered.shots.ada).toHaveLength(1);
  });

  it("hides the opponent fleet until every ship has sunk", () => {
    const state = placeBoth();
    const hit = battleshipEngine.applyMove(state, "ada", { type: "fire", r: 0, c: 5 });
    const ada = battleshipEngine.getPlayerView(hit, "ada");
    const bea = battleshipEngine.getPlayerView(hit, "bea");
    expect(ada.yourShots[0]?.result).toBe("hit");
    expect(ada.yourShots[0]?.sunkKind).toBeUndefined();
    expect(ada.opponentFleet).toBeNull();
    expect(containsCell(ada, 0, 5)).toBe(true);
    expect(containsCell(ada, 1, 5)).toBe(false);
    expect(containsCell(ada, 0, 6)).toBe(false);
    const adaJson = JSON.stringify(ada);
    const beaJson = JSON.stringify(bea);
    expect(adaJson).not.toContain('"c":6');
    expect(adaJson).not.toContain('"c":7');
    expect(adaJson).not.toContain('"c":8');
    expect(adaJson).not.toContain('"c":9');
    expect(beaJson).not.toContain('"c":0');
    expect(beaJson).not.toContain('"c":1');
    expect(beaJson).not.toContain('"c":2');
    expect(beaJson).not.toContain('"c":3');
    expect(beaJson).not.toContain('"c":4');
    expect(bea.yourFleet.find((ship) => ship.kind === "carrier")?.hits).toBe(1);
  });

  it("names the player who sinks the last ship", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    let state = battleshipEngine.createGame(["ada", "bea"]);
    state = battleshipEngine.applyMove(state, "ada", { type: "place", ships: standardFleet() });
    state = battleshipEngine.applyMove(state, "bea", { type: "place", ships: rightSideFleet() });
    const targets = expand(rightSideFleet());
    let miss = 0;
    for (const cell of targets) {
      expect(state.turnPlayerId).toBe("ada");
      state = battleshipEngine.applyMove(state, "ada", { type: "fire", r: cell.r, c: cell.c });
      if (battleshipEngine.getOutcome(state)) break;
      state = battleshipEngine.applyMove(state, "bea", {
        type: "fire",
        r: miss < 10 ? 1 : 3,
        c: miss % 10,
      });
      miss += 1;
    }
    const outcome = battleshipEngine.getOutcome(state);
    expect(outcome?.winnerIds).toEqual(["ada"]);
    const ada = battleshipEngine.getPlayerView(state, "ada");
    expect(ada.phase).toBe("finished");
    expect(ada.opponentFleet?.map((ship) => ship.kind).sort()).toEqual(
      ["battleship", "carrier", "cruiser", "destroyer", "submarine"],
    );
    expect(ada.yourShots.filter((shot) => shot.result === "sunk")).toHaveLength(5);
  });
});
