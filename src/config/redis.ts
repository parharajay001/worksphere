import { z } from "zod";

const redisEnvironmentSchema = z.object({
  REDIS_URL: z.url({ protocol: /^rediss?$/ }).default("redis://localhost:6379"),
});

export type RedisEnvironment = z.infer<typeof redisEnvironmentSchema>;

export function parseRedisEnvironment(
  values: Record<string, string | undefined>,
) {
  const result = redisEnvironmentSchema.safeParse(values);
  if (!result.success)
    throw new Error(
      "Invalid environment: REDIS_URL. Check .env.example and your environment configuration.",
    );
  return result.data;
}
