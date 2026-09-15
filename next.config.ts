import type { NextConfig } from "next";
import { parseEnvironment } from "./src/config/env.ts";

// Next.js loads .env files before evaluating this config in dev, build, and start.
parseEnvironment(process.env);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
