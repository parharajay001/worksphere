import { z } from "zod";

const databaseEnvironmentSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }).refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    const schema = url.searchParams.get("schema") ?? "public";
    return Boolean(
      url.hostname &&
      url.username &&
      /^\/[^/]+$/.test(url.pathname) &&
      !url.hash &&
      /^[a-z_][a-z0-9_]*$/.test(schema),
    );
  }, "Must be a PostgreSQL connection URL with a host, user, database, and valid schema"),
});

const environmentSchema = databaseEnvironmentSchema.extend({
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

export function parseDatabaseEnvironment(
  values: Record<string, string | undefined>,
) {
  return parseConfiguration(databaseEnvironmentSchema, values);
}

export function parseEnvironment(
  values: Record<string, string | undefined>,
): Environment {
  return parseConfiguration(environmentSchema, values);
}

function parseConfiguration<T>(
  schema: z.ZodType<T>,
  values: Record<string, string | undefined>,
): T {
  const result = schema.safeParse(values);

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
