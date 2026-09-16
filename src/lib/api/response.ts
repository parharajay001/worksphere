import "server-only";
import type { AppError } from "./errors.ts";

export type ApiSuccess<T> = { data: T; meta: { requestId: string } };
export type ApiFailure = {
  error: {
    code: AppError["code"];
    message: string;
    details?: AppError["issues"];
  };
  meta: { requestId: string };
};

export type ApiResult<T = unknown> =
  | { data: T; status: 200 | 201 | 202; headers?: HeadersInit }
  | { body: BodyInit; status: 200; headers?: HeadersInit }
  | { status: 204; headers?: HeadersInit };

export function success<T>(
  data: T,
  options: { status?: 200 | 201 | 202; headers?: HeadersInit } = {},
): ApiResult<T> {
  return { data, status: options.status ?? 200, headers: options.headers };
}

export function noContent(headers?: HeadersInit): ApiResult<never> {
  return { status: 204, headers };
}

export function raw(body: BodyInit, headers?: HeadersInit): ApiResult<never> {
  return { body, status: 200, headers };
}

function responseHeaders(requestId: string, initial?: HeadersInit) {
  const headers = new Headers(initial);
  headers.set("X-Request-ID", requestId);
  headers.set("Cache-Control", "no-store");
  return headers;
}

export function successResponse(
  result: ApiResult,
  requestId: string,
): Response {
  const headers = responseHeaders(requestId, result.headers);
  if (result.status === 204)
    return new Response(null, { status: 204, headers });
  if ("body" in result)
    return new Response(result.body, { status: result.status, headers });
  const body: ApiSuccess<unknown> = { data: result.data, meta: { requestId } };
  return Response.json(body, { status: result.status, headers });
}

export function errorResponse(error: AppError, requestId: string): Response {
  const body: ApiFailure = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.issues?.length ? { details: error.issues } : {}),
    },
    meta: { requestId },
  };
  return Response.json(body, {
    status: error.status,
    headers: responseHeaders(requestId, error.headers),
  });
}
