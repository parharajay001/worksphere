import "server-only";
import { z } from "zod";
import { AppError } from "./errors.ts";
import type { RouteParams } from "./handler.ts";

export const MAX_JSON_BYTES = 64 * 1024;

export async function parseInput<T>(
  schema: z.ZodType<T>,
  value: unknown,
): Promise<T> {
  const result = await schema.safeParseAsync(value);
  if (!result.success) {
    throw new AppError("VALIDATION_ERROR", {
      issues: result.error.issues.slice(0, 20).map((issue) => ({
        path: issue.path.map(String).join(".").slice(0, 160),
        code: issue.code,
        // Zod/custom messages may interpolate input, enum values, or patterns.
        message:
          issue.code === "unrecognized_keys"
            ? "Unexpected field."
            : "Invalid value.",
      })),
    });
  }
  return result.data;
}

export async function parseQuery<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  const values: Record<string, string> = Object.create(null);
  for (const [key, value] of new URL(request.url).searchParams) {
    if (Object.hasOwn(values, key)) throw new AppError("BAD_REQUEST");
    values[key] = value;
  }
  return parseInput(schema, values);
}

export async function parseParams<T>(
  params: Promise<RouteParams>,
  schema: z.ZodType<T>,
): Promise<T> {
  return parseInput(schema, await params);
}

export async function parseJson<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes = MAX_JSON_BYTES,
): Promise<T> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0)
    throw new RangeError("maxBytes must be a positive integer");
  const mediaType = request.headers
    .get("content-type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  if (
    !mediaType ||
    !/^application\/(?:json|[a-z0-9!#$&^_.+-]+\+json)$/.test(mediaType)
  ) {
    throw new AppError("UNSUPPORTED_MEDIA_TYPE");
  }
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) throw new AppError("BAD_REQUEST");
    if (Number(contentLength) > maxBytes)
      throw new AppError("PAYLOAD_TOO_LARGE");
  }
  if (!request.body) throw new AppError("INVALID_JSON");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        void reader.cancel().catch(() => undefined);
        throw new AppError("PAYLOAD_TOO_LARGE");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("BAD_REQUEST", { cause: error });
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(body),
    );
  } catch (error) {
    throw new AppError("INVALID_JSON", { cause: error });
  }
  return parseInput(schema, decoded);
}
