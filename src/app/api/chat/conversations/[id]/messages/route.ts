import { createApiHandler } from "@/lib/api/handler";
import { parseJson, parseParams, parseQuery } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import {
  conversationIdSchema,
  createMessageSchema,
  messageQuerySchema,
} from "@/modules/chat/chat.schemas";
import { createMessage, listMessages } from "@/modules/chat/chat.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = createApiHandler(
  { route: "/api/chat/conversations/:id/messages" },
  async (request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { id } = await parseParams(context.params, conversationIdSchema);
    return success({
      page: await listMessages(
        user.id,
        id,
        await parseQuery(request, messageQuerySchema),
      ),
    });
  },
);
export const POST = createApiHandler(
  { route: "/api/chat/conversations/:id/messages" },
  async (request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { id } = await parseParams(context.params, conversationIdSchema);
    return success(
      {
        message: await createMessage(
          user.id,
          id,
          await parseJson(request, createMessageSchema),
        ),
      },
      { status: 201 },
    );
  },
);
