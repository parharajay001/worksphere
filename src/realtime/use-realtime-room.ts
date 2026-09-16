"use client";

import { useEffect, useRef } from "react";
import {
  realtimeSocket,
  subscribeRealtimeRoom,
  type RealtimeEventName,
  type RoomTarget,
} from "./client";

export function useRealtimeRoom<T>(
  room: RoomTarget,
  eventName: RealtimeEventName,
  listener: (payload: T) => void,
) {
  const listenerRef = useRef(listener);
  useEffect(() => {
    listenerRef.current = listener;
  }, [listener]);

  useEffect(() => {
    const socket = realtimeSocket();
    const target = { kind: room.kind, id: room.id } as RoomTarget;
    const handle = (payload: T) => listenerRef.current(payload);
    socket.on(eventName, handle);
    const unsubscribeRoom = subscribeRealtimeRoom(target);

    return () => {
      socket.off(eventName, handle);
      unsubscribeRoom();
    };
  }, [room.kind, room.id, eventName]);
}

export function useRealtimeUserEvent<T>(
  eventName: RealtimeEventName,
  listener: (payload: T) => void,
) {
  const listenerRef = useRef(listener);
  useEffect(() => {
    listenerRef.current = listener;
  }, [listener]);

  useEffect(() => {
    const socket = realtimeSocket();
    const handle = (payload: T) => listenerRef.current(payload);
    socket.on(eventName, handle);
    if (!socket.connected) socket.connect();
    return () => {
      socket.off(eventName, handle);
    };
  }, [eventName]);
}
