import "server-only";
import { parseDatabaseEnvironment } from "../config/env.ts";
import { createDatabaseClient } from "./create-client.ts";

const globalDatabase = globalThis as unknown as {
  worksphereDatabase?: ReturnType<typeof createDatabaseClient>;
};

// Next.js can preserve this global across a schema change during development.
// Reuse it only when the generated client has the current model surface.
const reusableDatabase = globalDatabase.worksphereDatabase;
export const database =
  reusableDatabase &&
  "comment" in reusableDatabase &&
  "notification" in reusableDatabase
    ? reusableDatabase
    : createDatabaseClient(parseDatabaseEnvironment(process.env).DATABASE_URL);

// Next.js development reloads modules; keep one connection pool per process.
if (process.env.NODE_ENV !== "production")
  globalDatabase.worksphereDatabase = database;
