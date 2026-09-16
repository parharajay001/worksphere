import "server-only";
import { createClient } from "redis";
import { parseRedisEnvironment } from "../config/redis.ts";

type RedisClient = ReturnType<typeof createClient>;
type RedisState = {
  client?: RedisClient;
  connecting?: Promise<RedisClient | null>;
  unavailableUntil: number;
};

const globalCache = globalThis as typeof globalThis & {
  worksphereRedis?: RedisState;
};
const state =
  globalCache.worksphereRedis ??
  (globalCache.worksphereRedis = { unavailableUntil: 0 });

export async function getRedisClient() {
  if (process.env.REDIS_DISABLED === "true") return null;
  if (state.client?.isReady) return state.client;
  if (state.unavailableUntil > Date.now()) return null;
  if (state.connecting) return state.connecting;

  state.connecting = (async () => {
    const client = createClient({
      url: parseRedisEnvironment(process.env).REDIS_URL,
      socket: { connectTimeout: 500 },
    });
    // Prevent a Redis outage from becoming an unhandled process error.
    client.on("error", () => undefined);
    try {
      await client.connect();
      state.client = client;
      return client;
    } catch {
      state.unavailableUntil = Date.now() + 10_000;
      client.destroy();
      return null;
    }
  })();
  try {
    return await state.connecting;
  } finally {
    state.connecting = undefined;
  }
}

export async function closeRedisClient() {
  if (!state.client) return;
  await state.client.quit().catch(() => state.client?.destroy());
  state.client = undefined;
}
