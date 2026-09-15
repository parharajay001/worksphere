import nextEnv from "@next/env";

// Use the same .env file precedence as Next.js for CLI tools and database scripts.
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
