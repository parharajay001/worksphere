import "server-only";
import { parseDatabaseEnvironment } from "../config/env.ts";
import { createDatabaseClient } from "./create-client.ts";

const globalDatabase = globalThis as unknown as {
  worksphereDatabase?: ReturnType<typeof createDatabaseClient>;
};

export const database =
  globalDatabase.worksphereDatabase ??
  createDatabaseClient(parseDatabaseEnvironment(process.env).DATABASE_URL);

// Next.js development reloads modules; keep one connection pool per process.
if (process.env.NODE_ENV !== "production")
  globalDatabase.worksphereDatabase = database;
