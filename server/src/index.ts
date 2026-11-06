import { existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "socket.io";
import { sweep } from "./rooms/service.ts";
import { attachSockets, broadcastRoom } from "./socket/handlers.ts";

const port = Number(process.env.PORT ?? 4010);
const app = express();

app.use((_request, response, next) => {
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
  next();
});

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.use((request, response, next) => {
    if (request.method !== "GET" || request.path.startsWith("/socket.io")) {
      next();
      return;
    }
    response.sendFile(path.join(dist, "index.html"));
  });
}

const httpServer = createServer(app);
const io = new Server(httpServer);
attachSockets(io);

setInterval(() => {
  const result = sweep();
  for (const code of result.closed) io.to(`room:${code}`).emit("room:closed", { code });
  for (const code of result.changed) broadcastRoom(io, code);
}, 30_000).unref();

httpServer.listen(port, "0.0.0.0", () => {
  console.info(`boardroom server listening on ${port}`);
});
