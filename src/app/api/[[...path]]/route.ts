import { createApiHandler } from "../../../lib/api/handler.ts";
import { AppError } from "../../../lib/api/errors.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const notFound = createApiHandler({ route: "/api/[[...path]]" }, () => {
  throw new AppError("NOT_FOUND");
});

export const GET = notFound;
export const HEAD = notFound;
export const OPTIONS = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
