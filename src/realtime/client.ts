"use client";

import { io, type Socket } from "socket.io-client";
import type { RealtimeEventName, RoomTarget } from "./contracts";

let socket: Socket | undefined;
const rooms = new Map<string, { target: RoomTarget; subscribers: number }>();

export function realtimeSocket() {
  if (socket) return socket;
  socket = io(process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:3001", {
    autoConnect: false,
    withCredentials: true,
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
  });
  socket.on("connect", () => {
    for (const room of rooms.values()) socket?.emit("room:join", room.target);
  });
  return socket;
}

export function subscribeRealtimeRoom(target: RoomTarget) {
  const client = realtimeSocket();
  const key = `${target.kind}:${target.id}`;
  const existing = rooms.get(key);
  if (existing) existing.subscribers += 1;
  else {
    rooms.set(key, { target, subscribers: 1 });
    if (client.connected) client.emit("room:join", target);
  }
  if (!client.connected) client.connect();

  return () => {
    const current = rooms.get(key);
    if (!current) return;
    current.subscribers -= 1;
    if (current.subscribers > 0) return;
    rooms.delete(key);
    if (client.connected) client.emit("room:leave", target);
  };
}

export type { RealtimeEventName, RoomTarget };
