import { describe, expect, it, vi } from "vitest";
import {
  EMPTY_LOBBY_MS,
  MAX_ROOMS,
  RECONNECT_GRACE_MS,
  allowAttempt,
  createRoom,
  disconnectSocket,
  enqueue,
  joinRoom,
  leaveRoom,
  playMove,
  queueDepth,
  rejoinRoom,
  resetRooms,
  snapshot,
  startMatch,
  sweep,
} from "./service.ts";

function seatTwo() {
  const created = createRoom("Ada", "sock-ada");
  if (!created.ok) throw new Error(created.message);
  const joined = joinRoom(created.session.code, "Bea", "sock-bea");
  if (!joined.ok) throw new Error(joined.message);
  return { created, joined };
}

describe("rooms", () => {
  it("seats two players and refuses a third", () => {
    resetRooms();
    const { created, joined } = seatTwo();
    const third = joinRoom(created.session.code, "Cam", "sock-cam");
    expect(created.session.token).not.toBe(created.session.playerId);
    expect(joined.room.players).toHaveLength(2);
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.message).toBe("This room is full.");
  });

  it("rejects a rejoin that only knows the player id", () => {
    resetRooms();
    const { created } = seatTwo();
    const stolen = rejoinRoom(
      created.session.code,
      created.session.playerId,
      "this-is-not-the-issued-token-value",
      "sock-thief",
    );
    expect(stolen.ok).toBe(false);
    const back = rejoinRoom(
      created.session.code,
      created.session.playerId,
      created.session.token,
      "sock-ada-2",
    );
    expect(back.ok).toBe(true);
  });

  it("keeps a started match going when the host disconnects, then passes the host", () => {
    resetRooms();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { created, joined } = seatTwo();
    const started = startMatch(created.session.code, created.session.playerId);
    expect(started.ok).toBe(true);
    disconnectSocket("sock-ada", 1_000);
    const waiting = snapshot(created.session.code);
    expect(waiting?.room.phase).toBe("playing");
    expect(waiting?.room.hostId).toBe(created.session.playerId);
    expect(waiting?.room.players.find((player) => player.id === created.session.playerId)?.connected).toBe(false);
    sweep(1_000 + RECONNECT_GRACE_MS + 1);
    const passed = snapshot(created.session.code);
    expect(passed?.room.phase).toBe("playing");
    expect(passed?.room.hostId).toBe(joined.session.playerId);
    const returned = rejoinRoom(
      created.session.code,
      created.session.playerId,
      created.session.token,
      "sock-ada-back",
    );
    expect(returned.ok).toBe(true);
    expect(snapshot(created.session.code)?.room.hostId).toBe(joined.session.playerId);
  });

  it("forfeits on leave and refuses a new player after the start", () => {
    resetRooms();
    const { created, joined } = seatTwo();
    startMatch(created.session.code, created.session.playerId);
    const late = joinRoom(created.session.code, "Cam", "sock-cam");
    expect(late.ok).toBe(false);
    const left = leaveRoom(created.session.code, created.session.playerId);
    expect(left.ok).toBe(true);
    const after = snapshot(created.session.code);
    expect(after?.room.phase).toBe("finished");
    const bea = after?.views.find((view) => view.playerId === joined.session.playerId);
    expect(bea?.update.view.winnerId).toBe(joined.session.playerId);
    expect(JSON.stringify(bea?.update.view)).not.toContain(created.session.token);
  });

  it("does not put the opponent fleet in a mid-game view", () => {
    resetRooms();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { created, joined } = seatTwo();
    startMatch(created.session.code, created.session.playerId);
    const adaFleet = [
      { kind: "carrier", r: 0, c: 0, dir: "horizontal" },
      { kind: "battleship", r: 2, c: 0, dir: "horizontal" },
      { kind: "cruiser", r: 4, c: 0, dir: "horizontal" },
      { kind: "submarine", r: 6, c: 0, dir: "horizontal" },
      { kind: "destroyer", r: 8, c: 0, dir: "horizontal" },
    ];
    const beaFleet = [
      { kind: "carrier", r: 0, c: 5, dir: "vertical" },
      { kind: "battleship", r: 0, c: 6, dir: "vertical" },
      { kind: "cruiser", r: 0, c: 7, dir: "vertical" },
      { kind: "submarine", r: 0, c: 8, dir: "vertical" },
      { kind: "destroyer", r: 0, c: 9, dir: "vertical" },
    ];
    expect(playMove(created.session.code, created.session.playerId, { type: "place", ships: adaFleet }).ok).toBe(true);
    expect(playMove(created.session.code, joined.session.playerId, { type: "place", ships: beaFleet }).ok).toBe(true);
    expect(playMove(created.session.code, created.session.playerId, { type: "fire", r: 0, c: 5 }).ok).toBe(true);
    const views = snapshot(created.session.code)?.views ?? [];
    const ada = views.find((view) => view.playerId === created.session.playerId);
    const raw = JSON.stringify(ada?.update.view);
    expect(ada?.update.view.opponentFleet).toBeNull();
    expect(raw).not.toContain('"c":6');
    expect(raw).not.toContain('"c":9');
    expect(raw).not.toContain(created.session.token);
    const repeat = playMove(created.session.code, created.session.playerId, { type: "fire", r: 1, c: 5 });
    expect(repeat.ok).toBe(false);
  });

  it("limits how fast a client can ask for a seat", () => {
    resetRooms();
    const now = 5_000;
    for (let count = 0; count < 20; count += 1) expect(allowAttempt("10.0.0.8", now)).toBe(true);
    expect(allowAttempt("10.0.0.8", now)).toBe(false);
    expect(allowAttempt("10.0.0.9", now)).toBe(true);
  });

  it("forgets a queue entry once the job finishes", async () => {
    resetRooms();
    await enqueue("not-a-room", () => undefined);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(queueDepth()).toBe(0);
  });

  it("closes a lobby after half an hour even while the host is connected", () => {
    resetRooms();
    const created = createRoom("Ada", "sock-ada", 1_000);
    if (!created.ok) throw new Error(created.message);
    const early = sweep(1_000 + 60_000);
    expect(early.closed).not.toContain(created.session.code);
    const later = sweep(1_000 + EMPTY_LOBBY_MS + 1);
    expect(later.closed).toContain(created.session.code);
    expect(snapshot(created.session.code)).toBeNull();
  });

  it("stops opening rooms once the table is full", () => {
    resetRooms();
    for (let count = 0; count < MAX_ROOMS; count += 1) {
      const created = createRoom(`Ada${count}`, `sock-${count}`);
      expect(created.ok).toBe(true);
    }
    const extra = createRoom("Bea", "sock-extra");
    expect(extra.ok).toBe(false);
  });
});
