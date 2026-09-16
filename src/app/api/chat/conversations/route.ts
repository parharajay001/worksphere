import { createApiHandler } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { createConversationSchema } from "@/modules/chat/chat.schemas";
import { ensureConversation } from "@/modules/chat/chat.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createApiHandler(
  { route: "/api/chat/conversations" },
  async (request) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const conversation = await ensureConversation(
      user.id,
      await parseJson(request, createConversationSchema),
    );
    return success({ conversation }, { status: 201 });
  },
);
