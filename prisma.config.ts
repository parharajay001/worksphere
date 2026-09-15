import "./src/config/load-env.ts";
import { defineConfig } from "prisma/config";
import { parseDatabaseEnvironment } from "./src/config/env.ts";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --conditions=react-server --import tsx prisma/seed.ts",
  },
  datasource: {
    url: parseDatabaseEnvironment(process.env).DATABASE_URL,
  },
});
