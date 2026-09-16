import "server-only";
import { getRedisClient } from "../cache/redis-client.ts";
import {
  realtimeChannel,
  realtimeEventSchema,
  type RealtimeEvent,
} from "./contracts.ts";

// Persistence is authoritative. Realtime delivery is deliberately best-effort.
export async function publishRealtimeEvent(event: RealtimeEvent) {
  const parsed = realtimeEventSchema.parse(event);
  try {
    const redis = await getRedisClient();
    if (!redis) return false;
    await redis.publish(realtimeChannel, JSON.stringify(parsed));
    return true;
  } catch {
    return false;
  }
}
