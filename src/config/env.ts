import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.url({ protocol: /^https?$/ }).refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  }, "Must be an HTTP(S) origin without credentials, a path, query, or fragment"),
});

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(
  values: Record<string, string | undefined>,
): Environment {
  const result = environmentSchema.safeParse(values);

  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ];
    // Report field names only: configuration values may contain secrets.
    throw new Error(
      `Invalid environment: ${fields.join(", ")}. Check .env.example and your environment configuration.`,
    );
  }

  return result.data;
}
