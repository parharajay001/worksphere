import { createApiHandler } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { invitationTokenSchema } from "@/modules/invitations/invitation.schemas";
import { acceptInvitation } from "@/modules/invitations/invitation.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createApiHandler(
  { route: "/api/invitations/accept" },
  async (request) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { token } = await parseJson(request, invitationTokenSchema);
    await acceptInvitation(user.id, token);
    return success({ message: "Invitation accepted." });
  },
);
