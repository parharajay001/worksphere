import "server-only";
import { randomUUID } from "node:crypto";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getRequestId(request: Request): string {
  const supplied = request.headers.get("x-request-id");
  return supplied && uuidPattern.test(supplied)
    ? supplied.toLowerCase()
    : randomUUID();
}
