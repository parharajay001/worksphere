import "server-only";
import type { ErrorCode } from "../api/errors.ts";

export type RequestLog = {
  requestId: string;
  route: string;
  method: string;
  status: number;
  durationMs: number;
  errorCode?: ErrorCode;
};

export type RequestLogWriter = (entry: RequestLog) => void;

// Allowlist fields. Never serialize requests, headers, bodies, raw URLs,
// database errors, exception messages, stacks, or arbitrary log metadata.
export const writeRequestLog: RequestLogWriter = (entry) => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level:
        entry.status >= 500 ? "error" : entry.status >= 400 ? "warn" : "info",
      event: "http.request.completed",
      requestId: entry.requestId,
      route: entry.route,
      method: entry.method,
      status: entry.status,
      durationMs: entry.durationMs,
      ...(entry.errorCode ? { errorCode: entry.errorCode } : {}),
    }),
  );
};
