import "../src/config/load-env.ts";
import { database } from "../src/database/client.ts";

try {
  const result = await database.$queryRaw<
    Array<{ ready: number }>
  >`SELECT 1 AS ready`;
  if (result[0]?.ready !== 1) throw new Error("Unexpected database response");
  const [users, organizations, memberships] = await Promise.all([
    database.user.count(),
    database.organization.count(),
    database.membership.count(),
  ]);
  console.log(
    JSON.stringify({ status: "ok", users, organizations, memberships }),
  );
} catch {
  console.error(
    "Database check failed. Check DATABASE_URL and run npm run db:setup.",
  );
  process.exitCode = 1;
} finally {
  await database.$disconnect();
}
