import { createApiHandler } from "../../../lib/api/handler.ts";
import { AppError } from "../../../lib/api/errors.ts";
import { noContent, success } from "../../../lib/api/response.ts";
import { parseQuery } from "../../../lib/api/validation.ts";
import { healthQuerySchema } from "../../../modules/health/health.schema.ts";
import { createHealthService } from "../../../modules/health/health.service.ts";
import { healthRepository } from "../../../modules/health/health.repository.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const route = { route: "/api/health" };
const getHealth = createHealthService(healthRepository);
const allow = "GET, HEAD, OPTIONS";

export const GET = createApiHandler(route, async (request) => {
  const query = await parseQuery(request, healthQuerySchema);
  return success(await getHealth(query));
});
export const HEAD = GET;
export const OPTIONS = createApiHandler(route, () =>
  noContent({ Allow: allow }),
);

const methodNotAllowed = createApiHandler(route, () => {
  throw new AppError("METHOD_NOT_ALLOWED", { headers: { Allow: allow } });
});

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
