import { randomBytes } from "node:crypto";
import {
  GAMES,
  ROOM_CODE_ALPHABET,
  type GameUpdate,
  type PlayableGameId,
  type PublicRoom,
  type SeatSession,
} from "@boardroom/shared";
import { createReconnectToken, reconnectTokenMatches } from "../auth/reconnectToken.ts";
import {
  createMatch,
  finishByHost,
  playerLeft,
  seatedIds,
  submitMove,
  viewUpdate,
  type Match,
} from "../games/match.ts";

export const RECONNECT_GRACE_MS = 2 * 60 * 1000;
export const EMPTY_LOBBY_MS = 30 * 60 * 1000;
export const MATCH_MAX_MS = 2 * 60 * 60 * 1000;
export const MAX_ROOMS = 100;
export const MAX_ROOMS_PER_ADDRESS = 2;
export const MAX_SOCKETS = 200;
export const MAX_SOCKETS_PER_ADDRESS = 8;

const JOIN_WINDOW_MS = 60 * 1000;
const JOIN_LIMIT = 20;
const EVENT_LIMIT = 120;

interface Seat {
  id: string;
  name: string;
  tokenHash: string;
  socketId: string | null;
  connected: boolean;
  ready: boolean;
  wantsRematch: boolean;
  disconnectedAt: number | null;
  hostGraceHandled: boolean;
}

interface Room {
  code: string;
  hostId: string;
  phase: "lobby" | "playing" | "finished";
  gameId: PlayableGameId;
  players: Map<string, Seat>;
  game: Match | null;
  version: number;
  emptySince: number | null;
  openedAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  creatorAddress: string;
}

export interface RoomSnapshot {
  room: PublicRoom;
  views: PlayerView[];
}

export interface PlayerView {
  playerId: string;
  socketId: string | null;
  update: GameUpdate;
}

export interface SeatGranted {
  room: PublicRoom;
  session: SeatSession;
  previousSocketId?: string | null;
}

export interface LeaveGranted {
  closed: boolean;
  room: PublicRoom | null;
  departedSocketId: string | null;
  departedUpdate: GameUpdate | null;
}

type Failure = { ok: false; message: string };
type Success<T> = { ok: true } & T;

const rooms = new Map<string, Room>();
const queues = new Map<string, Promise<unknown>>();
const attempts = new Map<string, number[]>();
const events = new Map<string, number[]>();
const socketsByAddress = new Map<string, number>();

export function resetRooms(): void {
  rooms.clear();
  queues.clear();
  attempts.clear();
  events.clear();
  socketsByAddress.clear();
}

export function enqueue<T>(code: string, work: () => T | Promise<T>): Promise<T> {
  const previous = queues.get(code) ?? Promise.resolve();
  const run = previous.then(
    () => work(),
    () => work(),
  );
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  queues.set(code, tail);
  void tail.then(() => {
    if (queues.get(code) === tail) queues.delete(code);
  });
  return run;
}

export function queueDepth(): number {
  return queues.size;
}

export function hasRoom(code: string): boolean {
  return rooms.has(code.trim().toUpperCase());
}

export function withinSocketCap(openSockets: number): boolean {
  return openSockets <= MAX_SOCKETS;
}

export function allowAttempt(key: string, now = Date.now()): boolean {
  return takeSlot(attempts, key, JOIN_LIMIT, now);
}

export function allowEvent(key: string, now = Date.now()): boolean {
  return takeSlot(events, key, EVENT_LIMIT, now);
}

export function claimSocket(address: string): boolean {
  const current = socketsByAddress.get(address) ?? 0;
  if (current >= MAX_SOCKETS_PER_ADDRESS) return false;
  socketsByAddress.set(address, current + 1);
  return true;
}

export function releaseSocket(address: string): void {
  const current = socketsByAddress.get(address) ?? 0;
  if (current <= 1) socketsByAddress.delete(address);
  else socketsByAddress.set(address, current - 1);
}

function takeSlot(bucket: Map<string, number[]>, key: string, limit: number, now: number): boolean {
  const recent = (bucket.get(key) ?? []).filter((stamp) => now - stamp < JOIN_WINDOW_MS);
  if (recent.length >= limit) {
    bucket.set(key, recent);
    return false;
  }
  recent.push(now);
  bucket.set(key, recent);
  return true;
}

export function createRoom(
  name: string,
  socketId: string,
  now = Date.now(),
  address = "local",
): Success<SeatGranted> | Failure {
  if (rooms.size >= MAX_ROOMS) return fail("The table is full. Try again in a little while.");
  let openForAddress = 0;
  for (const existing of rooms.values()) {
    if (existing.creatorAddress === address) openForAddress += 1;
  }
  if (openForAddress >= MAX_ROOMS_PER_ADDRESS) return fail("You already have a room open.");
  const { seat, token } = makeSeat(name, socketId, new Set());
  const code = freshCode();
  const room: Room = {
    code,
    hostId: seat.id,
    phase: "lobby",
    gameId: "battleship",
    players: new Map([[seat.id, seat]]),
    game: null,
    version: 1,
    emptySince: null,
    openedAt: now,
    startedAt: null,
    finishedAt: null,
    creatorAddress: address,
  };
  rooms.set(code, room);
  console.info("room created");
  return { ok: true, room: toPublic(room), session: toSession(room, seat, token) };
}

export function joinRoom(code: string, name: string, socketId: string): Success<SeatGranted> | Failure {
  const room = findRoom(code);
  if (!room) return fail("That room does not exist.");
  if (room.phase !== "lobby") return fail("This game has already started.");
  if (room.players.size >= seatLimit(room.gameId).max) return fail("This room is full.");
  if ([...room.players.values()].some((seat) => seat.socketId === socketId)) {
    return fail("You are already in this room.");
  }
  const { seat, token } = makeSeat(name, socketId, namesOf(room));
  room.players.set(seat.id, seat);
  room.emptySince = null;
  touch(room);
  console.info("room joined");
  return { ok: true, room: toPublic(room), session: toSession(room, seat, token) };
}

export function rejoinRoom(
  code: string,
  playerId: string,
  token: string,
  socketId: string,
): Success<SeatGranted> | Failure {
  const room = findRoom(code);
  if (!room) return fail("That room does not exist.");
  const seat = room.players.get(playerId);
  if (!seat || !reconnectTokenMatches(token, seat.tokenHash)) {
    console.info("rejoin rejected");
    return fail("That code does not match a seat.");
  }
  const previousSocketId = seat.socketId;
  seat.socketId = socketId;
  seat.connected = true;
  seat.disconnectedAt = null;
  seat.hostGraceHandled = false;
  room.emptySince = null;
  touch(room);
  console.info("room rejoin");
  return {
    ok: true,
    room: toPublic(room),
    session: toSession(room, seat, token),
    previousSocketId,
  };
}

export function disconnectSocket(socketId: string, now = Date.now()): string | null {
  for (const room of rooms.values()) {
    const seat = [...room.players.values()].find((player) => player.socketId === socketId);
    if (!seat) continue;
    seat.socketId = null;
    seat.connected = false;
    seat.disconnectedAt = now;
    if ([...room.players.values()].every((player) => !player.connected)) room.emptySince = now;
    touch(room);
    console.info("disconnect");
    return room.code;
  }
  return null;
}

export function setReady(code: string, playerId: string, ready: boolean): Success<{ room: PublicRoom }> | Failure {
  const located = locate(code, playerId);
  if (!located.ok) return located;
  if (located.room.phase !== "lobby") return fail("The match has already started.");
  located.seat.ready = ready;
  touch(located.room);
  return { ok: true, room: toPublic(located.room) };
}

export function kickPlayer(code: string, playerId: string, targetId: string): Success<{ room: PublicRoom }> | Failure {
  const located = locate(code, playerId);
  if (!located.ok) return located;
  if (located.seat.id !== located.room.hostId) return fail("Only the host can remove a player.");
  if (located.room.phase !== "lobby") return fail("Players can only be removed from the lobby.");
  if (targetId === playerId) return fail("You cannot remove yourself.");
  if (!located.room.players.has(targetId)) return fail("That player is not in the room.");
  located.room.players.delete(targetId);
  touch(located.room);
  return { ok: true, room: toPublic(located.room) };
}

export function startMatch(code: string, playerId: string): Success<{ room: PublicRoom }> | Failure {
  const located = locate(code, playerId);
  if (!located.ok) return located;
  if (located.seat.id !== located.room.hostId) return fail("Only the host can start.");
  if (located.room.phase !== "lobby") return fail("The match has already started.");
  const rule = seatLimit(located.room.gameId);
  if (located.room.players.size < rule.min || located.room.players.size > rule.max) {
    return fail(countMessage(rule));
  }
  located.room.game = createMatch(located.room.gameId, [...located.room.players.keys()]);
  located.room.phase = "playing";
  located.room.startedAt = Date.now();
  located.room.finishedAt = null;
  for (const seat of located.room.players.values()) seat.ready = false;
  touch(located.room);
  console.info("room started");
  return { ok: true, room: toPublic(located.room) };
}

export function playMove(code: string, playerId: string, rawMove: unknown): Success<{ room: PublicRoom }> | Failure {
  const located = locate(code, playerId);
  if (!located.ok) return located;
  if (located.room.phase !== "playing" || !located.room.game) return fail("The match has not started.");
  const played = submitMove(located.room.game, playerId, rawMove);
  if (!played.ok) return fail(played.message);
  located.room.game = played.match;
  if (played.finished) {
    located.room.phase = "finished";
    located.room.finishedAt = Date.now();
    console.info("room finished");
  }
  touch(located.room);
  return { ok: true, room: toPublic(located.room) };
}

export function leaveRoom(code: string, playerId: string): Success<LeaveGranted> | Failure {
  const located = locate(code, playerId);
  if (!located.ok) return located;
  const { room, seat } = located;
  let departedUpdate: GameUpdate | null = null;
  if (room.phase === "playing" && room.game && seatedIds(room.game).includes(playerId)) {
    const before = viewUpdate(room.game, playerId);
    const left = playerLeft(room.game, playerId);
    room.game = left.match;
    if (left.finished) {
      room.phase = "finished";
      room.finishedAt = Date.now();
      console.info("forfeit");
    }
    const current = seatedIds(room.game).includes(playerId) ? viewUpdate(room.game, playerId) : before;
    departedUpdate = current;
  }
  touch(room);
  if (departedUpdate) departedUpdate = { ...departedUpdate, version: room.version };
  const departedSocketId = seat.socketId;
  room.players.delete(playerId);
  if (room.players.size === 0) {
    rooms.delete(room.code);
    console.info("room closed");
    return { ok: true, closed: true, room: null, departedSocketId, departedUpdate };
  }
  if (room.hostId === playerId) passHost(room);
  touch(room);
  if (departedUpdate) departedUpdate = { ...departedUpdate, version: room.version };
  return { ok: true, closed: false, room: toPublic(room), departedSocketId, departedUpdate };
}

export function endMatch(code: string, playerId: string): Success<{ room: PublicRoom }> | Failure {
  const located = locate(code, playerId);
  if (!located.ok) return located;
  if (located.seat.id !== located.room.hostId) return fail("Only the host can end the match.");
  if (located.room.phase === "lobby" || !located.room.game) return fail("The match has not started.");
  located.room.game = finishByHost(located.room.game);
  located.room.phase = "finished";
  located.room.finishedAt = Date.now();
  touch(located.room);
  console.info("room ended");
  return { ok: true, room: toPublic(located.room) };
}

export function restartMatch(code: string, playerId: string): Success<{ room: PublicRoom }> | Failure {
  const located = locate(code, playerId);
  if (!located.ok) return located;
  if (located.seat.id !== located.room.hostId) return fail("Only the host can start a rematch.");
  if (located.room.phase !== "finished") return fail("Finish this match before starting another.");
  const again = seatLimit(located.room.gameId);
  if (located.room.players.size < again.min || located.room.players.size > again.max) {
    return fail(countMessage(again));
  }
  located.room.game = createMatch(located.room.gameId, [...located.room.players.keys()]);
  located.room.phase = "playing";
  located.room.startedAt = Date.now();
  located.room.finishedAt = null;
  for (const seat of located.room.players.values()) {
    seat.ready = false;
    seat.wantsRematch = false;
  }
  touch(located.room);
  console.info("room rematch");
  return { ok: true, room: toPublic(located.room) };
}

export function nudgeRematch(code: string, playerId: string): Success<{ room: PublicRoom }> | Failure {
  const located = locate(code, playerId);
  if (!located.ok) return located;
  if (located.seat.id === located.room.hostId) return fail("You can start the rematch yourself.");
  if (located.room.phase !== "finished") return fail("The match is still going.");
  located.seat.wantsRematch = true;
  touch(located.room);
  return { ok: true, room: toPublic(located.room) };
}

export function snapshot(code: string): RoomSnapshot | null {
  const room = findRoom(code);
  if (!room) return null;
  return { room: toPublic(room), views: viewsFor(room) };
}

export function sweep(now = Date.now()): { closed: string[]; changed: string[] } {
  const closed: string[] = [];
  const changed: string[] = [];
  for (const room of [...rooms.values()]) {
    let dirty = false;
    for (const seat of [...room.players.values()]) {
      if (seat.connected || seat.disconnectedAt === null) continue;
      if (now - seat.disconnectedAt < RECONNECT_GRACE_MS) continue;
      if (room.phase === "lobby") {
        const wasHost = room.hostId === seat.id;
        room.players.delete(seat.id);
        if (wasHost) passHost(room);
        dirty = true;
        continue;
      }
      if (room.hostId === seat.id && !seat.hostGraceHandled) {
        seat.hostGraceHandled = true;
        passHost(room);
        dirty = true;
      }
    }
    const seats = [...room.players.values()];
    const everyoneGone =
      seats.length === 0 ||
      seats.every(
        (seat) =>
          !seat.connected && seat.disconnectedAt !== null && now - seat.disconnectedAt >= RECONNECT_GRACE_MS,
      );
    const lobbyExpired = room.phase === "lobby" && now - room.openedAt >= EMPTY_LOBBY_MS;
    const lobbyIdle =
      room.phase === "lobby" && room.emptySince !== null && now - room.emptySince >= EMPTY_LOBBY_MS;
    const matchExpired =
      room.phase === "playing" && room.startedAt !== null && now - room.startedAt >= MATCH_MAX_MS;
    const finishedExpired =
      room.phase === "finished" && room.finishedAt !== null && now - room.finishedAt >= EMPTY_LOBBY_MS;
    if (everyoneGone || lobbyIdle || lobbyExpired || matchExpired || finishedExpired) {
      rooms.delete(room.code);
      queues.delete(room.code);
      closed.push(room.code);
      console.info("room expired");
      continue;
    }
    if (dirty) {
      touch(room);
      changed.push(room.code);
    }
  }
  pruneBucket(attempts, now);
  pruneBucket(events, now);
  return { closed, changed };
}

function pruneBucket(bucket: Map<string, number[]>, now: number): void {
  for (const [key, stamps] of bucket) {
    const recent = stamps.filter((stamp) => now - stamp < JOIN_WINDOW_MS);
    if (recent.length === 0) bucket.delete(key);
    else if (recent.length !== stamps.length) bucket.set(key, recent);
  }
}

export function chooseGame(
  code: string,
  playerId: string,
  gameId: PlayableGameId,
): Success<{ room: PublicRoom }> | Failure {
  const located = locate(code, playerId);
  if (!located.ok) return located;
  if (located.seat.id !== located.room.hostId) return fail("Only the host can choose the game.");
  if (located.room.phase !== "lobby") return fail("The match has already started.");
  const rule = seatLimit(gameId);
  if (located.room.players.size > rule.max) return fail(`${rule.name} seats at most ${rule.max}.`);
  located.room.gameId = gameId;
  touch(located.room);
  return { ok: true, room: toPublic(located.room) };
}

function seatLimit(gameId: PlayableGameId): { min: number; max: number; name: string } {
  const game = GAMES.find((entry) => entry.id === gameId);
  return { min: game?.minPlayers ?? 2, max: game?.maxPlayers ?? 2, name: game?.name ?? "This game" };
}

function countMessage(rule: { min: number; max: number; name: string }): string {
  if (rule.min === rule.max) return `${rule.name} needs ${rule.min} players.`;
  return `${rule.name} needs ${rule.min} to ${rule.max} players.`;
}

function viewsFor(room: Room): PlayerView[] {
  if (!room.game) return [];
  const game = room.game;
  const ids = seatedIds(game);
  return [...room.players.values()]
    .filter((seat) => ids.includes(seat.id))
    .map((seat) => ({
      playerId: seat.id,
      socketId: seat.socketId,
      update: { ...viewUpdate(game, seat.id), version: room.version },
    }));
}

function locate(code: string, playerId: string): { ok: true; room: Room; seat: Seat } | Failure {
  const room = findRoom(code);
  if (!room) return fail("That room does not exist.");
  const seat = room.players.get(playerId);
  if (!seat) return fail("You are not seated in this room.");
  return { ok: true, room, seat };
}

function findRoom(code: string): Room | undefined {
  return rooms.get(code.trim().toUpperCase());
}

function makeSeat(name: string, socketId: string, taken: Set<string>): { seat: Seat; token: string } {
  const issued = createReconnectToken();
  const seat: Seat = {
    id: `p_${randomBytes(12).toString("base64url")}`,
    name: uniqueName(name.trim(), taken),
    tokenHash: issued.tokenHash,
    socketId,
    connected: true,
    ready: false,
    wantsRematch: false,
    disconnectedAt: null,
    hostGraceHandled: false,
  };
  return { seat, token: issued.token };
}

function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name;
  for (let count = 2; count < 50; count += 1) {
    const suffix = ` ${count}`;
    const candidate = `${name.slice(0, 20 - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return name;
}

function namesOf(room: Room): Set<string> {
  return new Set([...room.players.values()].map((seat) => seat.name));
}

function freshCode(): string {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const bytes = randomBytes(5);
    const code = [...bytes].map((byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join("");
    if (!rooms.has(code)) return code;
  }
  throw new Error("Could not allocate a room code.");
}

function passHost(room: Room): void {
  const next = [...room.players.values()].find((seat) => seat.connected) ?? [...room.players.values()][0];
  if (next) room.hostId = next.id;
}

function toPublic(room: Room): PublicRoom {
  return {
    code: room.code,
    phase: room.phase,
    gameId: room.gameId,
    hostId: room.hostId,
    version: room.version,
    players: [...room.players.values()].map((seat) => ({
      id: seat.id,
      name: seat.name,
      connected: seat.connected,
      ready: seat.ready,
      isHost: seat.id === room.hostId,
      wantsRematch: seat.wantsRematch,
    })),
  };
}

function toSession(room: Room, seat: Seat, token: string): SeatSession {
  return { code: room.code, playerId: seat.id, token, name: seat.name };
}

function touch(room: Room): void {
  room.version += 1;
}

function fail(message: string): Failure {
  return { ok: false, message };
}
