import { createApiHandler } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { createInvitationSchema } from "@/modules/invitations/invitation.schemas";
import {
  createInvitation,
  listInvitations,
} from "@/modules/invitations/invitation.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function current() {
  const user = await getSessionUser();
  if (!user) throw new AppError("UNAUTHENTICATED");
  return user;
}
export const GET = createApiHandler(
  { route: "/api/invitations" },
  async (request) => {
    const user = await current();
    const organizationId = new URL(request.url).searchParams.get(
      "organizationId",
    );
    if (!organizationId) throw new AppError("VALIDATION_ERROR");
    return success({
      invitations: await listInvitations(user.id, organizationId),
    });
  },
);
export const POST = createApiHandler(
  { route: "/api/invitations" },
  async (request) => {
    const user = await current();
    return success(
      {
        invitation: await createInvitation(
          user.id,
          await parseJson(request, createInvitationSchema),
        ),
      },
      { status: 201 },
    );
  },
);
