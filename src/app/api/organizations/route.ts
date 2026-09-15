import { createApiHandler } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { createOrganizationSchema } from "@/modules/organizations/organization.schemas";
import {
  createOrganization,
  getOrganizations,
} from "@/modules/organizations/organization.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function user() {
  const current = await getSessionUser();
  if (!current) throw new AppError("UNAUTHENTICATED");
  return current;
}
export const GET = createApiHandler({ route: "/api/organizations" }, async () =>
  success({ organizations: await getOrganizations((await user()).id) }),
);
export const POST = createApiHandler(
  { route: "/api/organizations" },
  async (request) =>
    success(
      {
        organization: await createOrganization(
          (await user()).id,
          await parseJson(request, createOrganizationSchema),
        ),
      },
      { status: 201 },
    ),
);
