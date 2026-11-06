import type { Server, Socket } from "socket.io";
import {
  configureSchema,
  createRoomSchema,
  joinRoomSchema,
  kickSchema,
  nudgeSchema,
  readySchema,
  rejoinRoomSchema,
} from "@boardroom/shared";
import type { ClientAck } from "@boardroom/shared";
import {
  allowAttempt,
  allowEvent,
  claimSocket,
  chooseGame,
  createRoom,
  disconnectSocket,
  endMatch,
  enqueue,
  hasRoom,
  joinRoom,
  kickPlayer,
  leaveRoom,
  nudgeRematch,
  playMove,
  rejoinRoom,
  restartMatch,
  setReady,
  releaseSocket,
  snapshot,
  startMatch,
  withinSocketCap,
} from "../rooms/service.ts";

interface SeatBinding {
  code?: string;
  playerId?: string;
}

function ackOf(ack: unknown): (result: ClientAck) => void {
  return typeof ack === "function" ? (ack as (result: ClientAck) => void) : () => undefined;
}

function addressOf(socket: Socket): string {
  return socket.handshake.address || socket.id;
}

function paced(socket: Socket, reply: (result: ClientAck) => void): boolean {
  if (allowEvent(addressOf(socket))) return true;
  reply({ ok: false, message: "Too many attempts. Wait a minute and try again." });
  return false;
}

function bind(socket: Socket, code: string, playerId: string): void {
  const data = socket.data as SeatBinding;
  data.code = code;
  data.playerId = playerId;
  void socket.join(`room:${code}`);
}

function unbind(socket: Socket): void {
  const data = socket.data as SeatBinding;
  if (data.code) void socket.leave(`room:${data.code}`);
  data.code = undefined;
  data.playerId = undefined;
}

function seated(socket: Socket): { code: string; playerId: string } | null {
  const data = socket.data as SeatBinding;
  if (!data.code || !data.playerId) return null;
  return { code: data.code, playerId: data.playerId };
}

export function broadcastRoom(io: Server, code: string): void {
  const current = snapshot(code);
  if (!current) {
    io.to(`room:${code}`).emit("room:closed", { code });
    return;
  }
  io.to(`room:${code}`).emit("room:state", current.room);
  for (const view of current.views) {
    if (!view.socketId) continue;
    io.to(view.socketId).emit("game:view", view.update);
  }
}

async function releaseOtherRoom(io: Server, socket: Socket, nextCode: string): Promise<void> {
  const current = seated(socket);
  if (!current || current.code === nextCode) return;
  await enqueue(current.code, () => {
    disconnectSocket(socket.id);
    unbind(socket);
    broadcastRoom(io, current.code);
  });
}

export function attachSockets(io: Server): void {
  io.on("connection", (socket) => {
    const address = addressOf(socket);
    if (!withinSocketCap(io.sockets.sockets.size) || !claimSocket(address)) {
      socket.disconnect(true);
      return;
    }
    socket.on("room:create", (payload: unknown, ack?: unknown) => {
      const reply = ackOf(ack);
      if (!allowAttempt(addressOf(socket))) {
        reply({ ok: false, message: "Too many attempts. Wait a minute and try again." });
        return;
      }
      const parsed = createRoomSchema.safeParse(payload);
      if (!parsed.success) {
        reply({ ok: false, message: "Use a name between 2 and 20 characters." });
        return;
      }
      void enqueue(`create:${socket.id}`, async () => {
        await releaseOtherRoom(io, socket, "");
        const created = createRoom(parsed.data.name, socket.id, Date.now(), addressOf(socket));
        if (!created.ok) {
          reply(created);
          return;
        }
        bind(socket, created.session.code, created.session.playerId);
        broadcastRoom(io, created.session.code);
        reply({ ok: true, session: created.session });
      });
    });

    socket.on("room:join", (payload: unknown, ack?: unknown) => {
      const reply = ackOf(ack);
      if (!allowAttempt(addressOf(socket))) {
        reply({ ok: false, message: "Too many attempts. Wait a minute and try again." });
        return;
      }
      const parsed = joinRoomSchema.safeParse(payload);
      if (!parsed.success) {
        reply({ ok: false, message: "Check the room code and use a name between 2 and 20 characters." });
        return;
      }
      if (!hasRoom(parsed.data.code)) {
        reply({ ok: false, message: "That room does not exist." });
        return;
      }
      void (async () => {
        await releaseOtherRoom(io, socket, parsed.data.code);
        await enqueue(parsed.data.code, () => {
        const joined = joinRoom(parsed.data.code, parsed.data.name, socket.id);
        if (!joined.ok) {
          reply(joined);
          return;
        }
        bind(socket, joined.session.code, joined.session.playerId);
        broadcastRoom(io, joined.session.code);
        reply({ ok: true, session: joined.session });
        });
      })();
    });

    socket.on("room:rejoin", (payload: unknown, ack?: unknown) => {
      const reply = ackOf(ack);
      if (!allowAttempt(addressOf(socket))) {
        reply({ ok: false, message: "Too many attempts. Wait a minute and try again." });
        return;
      }
      const parsed = rejoinRoomSchema.safeParse(payload);
      if (!parsed.success) {
        reply({ ok: false, message: "That code does not match a seat." });
        return;
      }
      if (!hasRoom(parsed.data.code)) {
        reply({ ok: false, message: "That room does not exist." });
        return;
      }
      void enqueue(parsed.data.code, () => {
        const returned = rejoinRoom(parsed.data.code, parsed.data.playerId, parsed.data.token, socket.id);
        if (!returned.ok) {
          reply(returned);
          return;
        }
        if (returned.previousSocketId && returned.previousSocketId !== socket.id) {
          const previous = io.sockets.sockets.get(returned.previousSocketId);
          if (previous) unbind(previous);
        }
        bind(socket, returned.session.code, returned.session.playerId);
        broadcastRoom(io, returned.session.code);
        reply({ ok: true, session: returned.session });
      });
    });

    socket.on("room:ready", (payload: unknown, ack?: unknown) => {
      const reply = ackOf(ack);
      if (!paced(socket, reply)) return;
      const seat = seated(socket);
      const parsed = readySchema.safeParse(payload);
      if (!seat || !parsed.success) {
        reply({ ok: false, message: "Sit down before you mark ready." });
        return;
      }
      void enqueue(seat.code, () => {
        const result = setReady(seat.code, seat.playerId, parsed.data.ready);
        if (!result.ok) {
          reply(result);
          return;
        }
        broadcastRoom(io, seat.code);
        reply({ ok: true });
      });
    });

    socket.on("room:kick", (payload: unknown, ack?: unknown) => {
      const reply = ackOf(ack);
      if (!paced(socket, reply)) return;
      const seat = seated(socket);
      const parsed = kickSchema.safeParse(payload);
      if (!seat || !parsed.success) {
        reply({ ok: false, message: "That player is not in the room." });
        return;
      }
      void enqueue(seat.code, () => {
        const result = kickPlayer(seat.code, seat.playerId, parsed.data.playerId);
        if (!result.ok) {
          reply(result);
          return;
        }
        for (const other of io.sockets.sockets.values()) {
          const bound = other.data as SeatBinding;
          if (bound.playerId === parsed.data.playerId) unbind(other);
        }
        broadcastRoom(io, seat.code);
        reply({ ok: true });
      });
    });

    socket.on("room:configure", (payload: unknown, ack?: unknown) => {
      const reply = ackOf(ack);
      if (!paced(socket, reply)) return;
      const seat = seated(socket);
      const parsed = configureSchema.safeParse(payload);
      if (!seat || !parsed.success) {
        reply({ ok: false, message: "Pick Battleship or UNO." });
        return;
      }
      void enqueue(seat.code, () => {
        const result = chooseGame(seat.code, seat.playerId, parsed.data.gameId);
        if (!result.ok) {
          reply(result);
          return;
        }
        broadcastRoom(io, seat.code);
        reply({ ok: true });
      });
    });

    socket.on("room:start", (_payload: unknown, ack?: unknown) => {
      const reply = ackOf(ack);
      if (!paced(socket, reply)) return;
      const seat = seated(socket);
      if (!seat) {
        reply({ ok: false, message: "Sit down before you start." });
        return;
      }
      void enqueue(seat.code, () => {
        const result = startMatch(seat.code, seat.playerId);
        if (!result.ok) {
          reply(result);
          return;
        }
        broadcastRoom(io, seat.code);
        reply({ ok: true });
      });
    });

    socket.on("room:restart", (_payload: unknown, ack?: unknown) => {
      const reply = ackOf(ack);
      if (!paced(socket, reply)) return;
      const seat = seated(socket);
      if (!seat) {
        reply({ ok: false, message: "Sit down before you start a rematch." });
        return;
      }
      void enqueue(seat.code, () => {
        const result = restartMatch(seat.code, seat.playerId);
        if (!result.ok) {
          reply(result);
          return;
        }
        broadcastRoom(io, seat.code);
        reply({ ok: true });
      });
    });

    socket.on("room:end", (_payload: unknown, ack?: unknown) => {
      const reply = ackOf(ack);
      if (!paced(socket, reply)) return;
      const seat = seated(socket);
      if (!seat) {
        reply({ ok: false, message: "Sit down before you end the match." });
        return;
      }
      void enqueue(seat.code, () => {
        const result = endMatch(seat.code, seat.playerId);
        if (!result.ok) {
          reply(result);
          return;
        }
        broadcastRoom(io, seat.code);
        reply({ ok: true });
      });
    });

    socket.on("room:leave", (_payload: unknown, ack?: unknown) => {
      const reply = ackOf(ack);
      if (!paced(socket, reply)) return;
      const seat = seated(socket);
      if (!seat) {
        reply({ ok: false, message: "You are not in a room." });
        return;
      }
      void enqueue(seat.code, () => {
        const result = leaveRoom(seat.code, seat.playerId);
        if (!result.ok) {
          reply(result);
          return;
        }
        if (result.departedSocketId && result.departedUpdate) {
          io.to(result.departedSocketId).emit("game:view", result.departedUpdate);
        }
        if (result.closed) io.to(`room:${seat.code}`).emit("room:closed", { code: seat.code });
        else broadcastRoom(io, seat.code);
        unbind(socket);
        reply({ ok: true });
      });
    });

    socket.on("game:move", (payload: unknown, ack?: unknown) => {
      const reply = ackOf(ack);
      if (!paced(socket, reply)) return;
      const seat = seated(socket);
      if (!seat) {
        reply({ ok: false, message: "Sit down before you play." });
        return;
      }
      void enqueue(seat.code, () => {
        const result = playMove(seat.code, seat.playerId, payload);
        if (!result.ok) {
          reply(result);
          return;
        }
        broadcastRoom(io, seat.code);
        reply({ ok: true });
      });
    });

    socket.on("game:nudge", (payload: unknown, ack?: unknown) => {
      const reply = ackOf(ack);
      if (!paced(socket, reply)) return;
      const seat = seated(socket);
      const parsed = nudgeSchema.safeParse(payload);
      if (!seat || !parsed.success) {
        reply({ ok: false, message: "The match is still going." });
        return;
      }
      void enqueue(seat.code, () => {
        const result = nudgeRematch(seat.code, seat.playerId);
        if (!result.ok) {
          reply(result);
          return;
        }
        broadcastRoom(io, seat.code);
        reply({ ok: true });
      });
    });

    socket.on("disconnect", () => {
      releaseSocket(address);
      const code = (socket.data as SeatBinding).code;
      const drop = () => {
        const gone = disconnectSocket(socket.id);
        if (gone) broadcastRoom(io, gone);
      };
      if (code) void enqueue(code, drop);
      else drop();
    });
  });
}
