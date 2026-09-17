import { createApiHandler } from "@/lib/api/handler";
import { parseJson, parseParams } from "@/lib/api/validation";
import { noContent, success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import {
  organizationIdSchema,
  updateOrganizationSchema,
} from "@/modules/organizations/organization.schemas";
import {
  deleteOrganization,
  requireMembership,
  updateOrganization,
} from "@/modules/organizations/organization.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function ctx(
  params: Promise<Record<string, string | string[] | undefined>>,
) {
  const current = await getSessionUser();
  if (!current) throw new AppError("UNAUTHENTICATED");
  const { id } = await parseParams(params, organizationIdSchema);
  return { current, id };
}
export const GET = createApiHandler(
  { route: "/api/organizations/:id" },
  async (_request, context) => {
    const { current, id } = await ctx(context.params);
    return success({
      organization: (await requireMembership(current.id, id)).organization,
    });
  },
);
export const PATCH = createApiHandler(
  { route: "/api/organizations/:id" },
  async (request, context) => {
    const { current, id } = await ctx(context.params);
    const input = await parseJson(request, updateOrganizationSchema);
    return success({
      organization: await updateOrganization(current.id, id, input),
    });
  },
);
export const DELETE = createApiHandler(
  { route: "/api/organizations/:id" },
  async (_request, context) => {
    const { current, id } = await ctx(context.params);
    await deleteOrganization(current.id, id);
    return noContent();
  },
);
