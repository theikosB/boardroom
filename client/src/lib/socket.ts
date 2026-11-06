import type { ClientAck } from "@boardroom/shared";
import { io, type Socket } from "socket.io-client";

export const socket: Socket = io({ autoConnect: false });

export function connectSocket(): Socket {
  if (!socket.connected) socket.connect();
  return socket;
}

export function request(event: string, payload: unknown = {}): Promise<ClientAck> {
  const current = connectSocket();
  return new Promise((resolve) => {
    current.timeout(8000).emit(event, payload, (error: Error | null, response?: ClientAck) => {
      if (error || !response) {
        resolve({
          ok: false,
          message: "The table is not responding. Start the server with npm run dev, then try again.",
        });
        return;
      }
      resolve(response);
    });
  });
}
