import "../src/config/load-env.ts";
import { database } from "../src/database/client.ts";

const email = process.argv[2];
const where =
  email === "--all"
    ? { email: { startsWith: "day4-", endsWith: "@worksphere.example" } }
    : email && /^day4-[0-9a-f-]+@worksphere\.example$/.test(email)
      ? { email }
      : null;
if (!where)
  throw new Error("Cleanup requires a generated Day 4 test email or --all.");
try {
  await database.user.deleteMany({ where });
} finally {
  await database.$disconnect();
}
