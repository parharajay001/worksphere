import type { NextConfig } from "next";
import { parseEnvironment } from "./src/config/env.ts";

// Next.js loads .env files before evaluating this config in dev, build, and start.
parseEnvironment(process.env);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    const isDevelopment = process.env.NODE_ENV === "development";
    const realtimeUrl = new URL(
      process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:3001",
    );
    const realtimeSocketOrigin = new URL(realtimeUrl);
    realtimeSocketOrigin.protocol =
      realtimeUrl.protocol === "https:" ? "wss:" : "ws:";
    const realtimeSources = [realtimeUrl.origin, realtimeSocketOrigin.origin]
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(" ");
    const contentSecurityPolicy = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data:",
      "font-src 'self' data:",
      `connect-src 'self' ${realtimeSources}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), microphone=()",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
