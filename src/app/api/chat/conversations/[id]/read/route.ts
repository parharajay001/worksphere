import { createApiHandler } from "@/lib/api/handler";
import { parseParams } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { conversationIdSchema } from "@/modules/chat/chat.schemas";
import { markConversationRead } from "@/modules/chat/chat.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createApiHandler(
  { route: "/api/chat/conversations/:id/read" },
  async (_request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { id } = await parseParams(context.params, conversationIdSchema);
    return success({ lastReadAt: await markConversationRead(user.id, id) });
  },
);
