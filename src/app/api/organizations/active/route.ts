import { createApiHandler } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { activeOrganizationSchema } from "@/modules/organizations/organization.schemas";
import {
  getActiveOrganization,
  setActiveOrganization,
} from "@/modules/organizations/active-organization";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = createApiHandler(
  { route: "/api/organizations/active" },
  async () => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    return success({ organization: await getActiveOrganization(user.id) });
  },
);
export const PUT = createApiHandler(
  { route: "/api/organizations/active" },
  async (request) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { id } = await parseJson(request, activeOrganizationSchema);
    return success({ organization: await setActiveOrganization(user.id, id) });
  },
);
