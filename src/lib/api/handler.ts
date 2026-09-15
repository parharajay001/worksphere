import "server-only";
import { performance } from "node:perf_hooks";
import { toAppError } from "./errors.ts";
import { getRequestId } from "./request-id.ts";
import { errorResponse, successResponse, type ApiResult } from "./response.ts";
import {
  writeRequestLog,
  type RequestLogWriter,
} from "../logging/request-logger.ts";

export type RouteParams = Record<string, string | string[] | undefined>;
export type ApiContext = { requestId: string; params: Promise<RouteParams> };
type NextRouteContext = { params: Promise<RouteParams> };
type ApiHandler = (
  request: Request,
  context: ApiContext,
) => ApiResult | Promise<ApiResult>;

export function createApiHandler(
  options: { route: string; log?: RequestLogWriter },
  handler: ApiHandler,
) {
  return async (
    request: Request,
    routeContext?: NextRouteContext,
  ): Promise<Response> => {
    const started = performance.now();
    const requestId = getRequestId(request);
    let response: Response;
    let errorCode;

    try {
      const result = await handler(request, {
        requestId,
        params: routeContext?.params ?? Promise.resolve({}),
      });
      response = successResponse(result, requestId);
    } catch (error) {
      const applicationError = toAppError(error);
      errorCode = applicationError.code;
      response = errorResponse(applicationError, requestId);
    }

    // HEAD mirrors GET headers/status, including failures, but never has a body.
    if (request.method === "HEAD")
      response = new Response(null, {
        status: response.status,
        headers: response.headers,
      });

    try {
      (options.log ?? writeRequestLog)({
        requestId,
        route: options.route,
        method: /^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)$/.test(
          request.method,
        )
          ? request.method
          : "OTHER",
        status: response.status,
        durationMs: Math.round((performance.now() - started) * 100) / 100,
        ...(errorCode ? { errorCode } : {}),
      });
    } catch {
      // A failing log sink must not convert a successful mutation into a retry.
      // This fallback contains no request values or error details.
      console.error('{"level":"error","event":"http.request.log_failed"}');
    }

    return response;
  };
}
