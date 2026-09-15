import { createApiHandler } from "@/lib/api/handler";
import { parseParams } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { organizationIdSchema } from "@/modules/organizations/organization.schemas";
import { getOrganizationMembers } from "@/modules/organizations/organization.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = createApiHandler(
  { route: "/api/organizations/:id/members" },
  async (_request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { id } = await parseParams(context.params, organizationIdSchema);
    return success({ members: await getOrganizationMembers(user.id, id) });
  },
);
