import { createApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { success } from "@/lib/api/response";
import { getSessionUser } from "@/modules/auth/session";
import { getActiveOrganization } from "@/modules/organizations/active-organization";
import { searchQuerySchema } from "@/modules/search/search.schemas";
import { searchWorkspace } from "@/modules/search/search.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = createApiHandler(
  { route: "/api/search" },
  async (request) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const parsed = searchQuerySchema.safeParse({
      q: new URL(request.url).searchParams.get("q") ?? "",
    });
    if (!parsed.success) throw new AppError("VALIDATION_ERROR");
    const organization = await getActiveOrganization(user.id);
    if (!organization) return success({ projects: [], tasks: [] });
    return success(
      await searchWorkspace(user.id, organization.id, parsed.data.q),
    );
  },
);
