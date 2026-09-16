import "server-only";
import "../config/load-env.ts";
import { createServer } from "node:http";
import { createClient } from "redis";
import { Server } from "socket.io";
import { parseEnvironment } from "../config/env.ts";
import { parseRedisEnvironment } from "../config/redis.ts";
import { SESSION_COOKIE } from "../modules/auth/auth.constants.ts";
import { getSessionUserByToken } from "../modules/auth/session.ts";
import { cookieValue } from "./cookie.ts";
import {
  realtimeChannel,
  realtimeEventSchema,
  roomName,
  roomTargetSchema,
  typingEventSchema,
} from "./contracts.ts";
import { authorizeRealtimeRoom } from "./rooms.ts";

const environment = parseEnvironment(process.env);
const port = Number(process.env.REALTIME_PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65_535)
  throw new Error("Invalid environment: REALTIME_PORT.");

const httpServer = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }
  response.writeHead(404).end();
});
const io = new Server(httpServer, {
  cors: { origin: environment.APP_URL, credentials: true },
  transports: ["websocket"],
  allowRequest: (request, callback) =>
    callback(null, request.headers.origin === environment.APP_URL),
});

io.use(async (socket, next) => {
  try {
    const token = cookieValue(socket.handshake.headers.cookie, SESSION_COOKIE);
    const user = await getSessionUserByToken(token);
    if (!user) return next(new Error("unauthorized"));
    socket.data.userId = user.id;
    next();
  } catch {
    next(new Error("unauthorized"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.data.userId as string;
  void socket.join(roomName.user(userId));

  socket.on("room:join", async (input, acknowledge) => {
    const parsed = roomTargetSchema.safeParse(input);
    if (!parsed.success) {
      if (typeof acknowledge === "function") acknowledge({ ok: false });
      return;
    }
    const room = await authorizeRealtimeRoom(userId, parsed.data);
    if (!room) {
      if (typeof acknowledge === "function") acknowledge({ ok: false });
      return;
    }
    await socket.join(room);
    if (parsed.data.kind !== "organization") void broadcastPresence(room);
    if (typeof acknowledge === "function") acknowledge({ ok: true });
  });

  socket.on("room:leave", async (input) => {
    const parsed = roomTargetSchema.safeParse(input);
    if (!parsed.success) return;
    const room =
      parsed.data.kind === "organization"
        ? roomName.organization(parsed.data.id)
        : parsed.data.kind === "project"
          ? roomName.project(parsed.data.id)
          : roomName.team(parsed.data.id);
    await socket.leave(room);
    if (parsed.data.kind !== "organization") void broadcastPresence(room);
  });

  socket.on("chat:typing", (input) => {
    const parsed = typingEventSchema.safeParse(input);
    if (!parsed.success) return;
    const room = roomName[parsed.data.target.kind](parsed.data.target.id);
    if (!socket.rooms.has(room)) return;
    socket.to(room).emit("chat.typing", {
      roomKind: parsed.data.target.kind,
      roomId: parsed.data.target.id,
      userId,
      active: parsed.data.active,
    });
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms].filter(
      (room) => room.startsWith("project:") || room.startsWith("team:"),
    );
    setTimeout(() => {
      for (const room of rooms) void broadcastPresence(room);
    }, 0);
  });
});

async function broadcastPresence(room: string) {
  const sockets = await io.in(room).fetchSockets();
  const userIds = [
    ...new Set(sockets.map((socket) => socket.data.userId as string)),
  ];
  io.to(room).emit("presence.changed", { userIds });
}

const subscriber = createClient({
  url: parseRedisEnvironment(process.env).REDIS_URL,
});
subscriber.on("error", () => undefined);
await subscriber.connect();
await subscriber.subscribe(realtimeChannel, (message) => {
  let candidate: unknown;
  try {
    candidate = JSON.parse(message);
  } catch {
    return;
  }
  const result = realtimeEventSchema.safeParse(candidate);
  if (!result.success) return;
  const event = result.data;
  const room =
    "userId" in event.target
      ? roomName.user(event.target.userId)
      : "projectId" in event.target
        ? roomName.project(event.target.projectId)
        : roomName[event.target.roomKind](event.target.roomId);
  io.to(room).emit(event.name, event.payload);
});

httpServer.listen(port, () => {
  console.log(
    JSON.stringify({
      level: "info",
      event: "realtime.started",
      port,
    }),
  );
});

async function shutdown(signal: string) {
  console.log(
    JSON.stringify({ level: "info", event: "realtime.stopping", signal }),
  );
  await subscriber.quit();
  await new Promise<void>((resolve) => io.close(() => resolve()));
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void shutdown(signal).then(() => process.exit(0)));
}
