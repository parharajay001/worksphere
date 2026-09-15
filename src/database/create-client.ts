import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import { parseDatabaseEnvironment } from "../config/env.ts";

// Scripts/tests own and disconnect these clients. Request code uses client.ts.
export function createDatabaseClient(connectionString: string) {
  const url = new URL(
    parseDatabaseEnvironment({ DATABASE_URL: connectionString }).DATABASE_URL,
  );
  const schema = url.searchParams.get("schema") ?? "public";
  url.searchParams.delete("schema");

  const adapter = new PrismaPg(
    {
      connectionString: url.toString(),
      max: 5,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
    },
    { schema },
  );

  // Do not log queries or parameters: they may contain credentials or tokens.
  return new PrismaClient({ adapter });
}
