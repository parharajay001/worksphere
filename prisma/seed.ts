import "../src/config/load-env.ts";
import { parseDatabaseEnvironment } from "../src/config/env.ts";
import { createDatabaseClient } from "../src/database/create-client.ts";
import { seedDevelopmentData } from "./seed-data.ts";

const { DATABASE_URL } = parseDatabaseEnvironment(process.env);
if (
  process.env.NODE_ENV === "production" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(new URL(DATABASE_URL).hostname)
) {
  throw new Error("Demo seeding is restricted to local development databases.");
}

const database = createDatabaseClient(DATABASE_URL);
try {
  const result = await seedDevelopmentData(database);
  console.log(
    `Demo seed ready: ${result.organizations.join(", ")}; ${result.users} users, ${result.teams} teams, ${result.projects} projects, and ${result.tasks} tasks.`,
  );
  console.log(`Local demo login: ${result.demoLogin} / WorkSphereDemo!2026`);
} catch {
  console.error(
    "Database seed failed. Check configuration and run npm run db:deploy first.",
  );
  process.exitCode = 1;
} finally {
  await database.$disconnect();
}
