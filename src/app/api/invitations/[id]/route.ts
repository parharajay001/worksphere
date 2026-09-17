import { createApiHandler } from "@/lib/api/handler";
import { noContent, success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import {
  resendInvitation,
  revokeInvitation,
} from "@/modules/invitations/invitation.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const DELETE = createApiHandler(
  { route: "/api/invitations/:id" },
  async (_request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const id = (await context.params).id;
    if (typeof id !== "string") throw new AppError("VALIDATION_ERROR");
    await revokeInvitation(user.id, id);
    return noContent();
  },
);
export const POST = createApiHandler(
  { route: "/api/invitations/:id" },
  async (_request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const id = (await context.params).id;
    if (typeof id !== "string") throw new AppError("VALIDATION_ERROR");
    return success({ invitation: await resendInvitation(user.id, id) });
  },
);
