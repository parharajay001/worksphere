import type { ConnectionOptions } from "bullmq";
import { parseRedisEnvironment } from "../config/redis.ts";

export function queueConnection(
  values: Record<string, string | undefined> = process.env,
): ConnectionOptions {
  const url = new URL(parseRedisEnvironment(values).REDIS_URL);
  const database = url.pathname.slice(1);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(database ? { db: Number(database) } : {}),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}
