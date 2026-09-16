import { createApiHandler } from "@/lib/api/handler";
import { parseJson, parseParams } from "@/lib/api/validation";
import { noContent, success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import {
  commentIdSchema,
  updateCommentSchema,
} from "@/modules/comments/comment.schemas";
import {
  deleteComment,
  updateComment,
} from "@/modules/comments/comment.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = createApiHandler(
  { route: "/api/comments/:id" },
  async (request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { id } = await parseParams(context.params, commentIdSchema);
    return success({
      comment: await updateComment(
        user.id,
        id,
        await parseJson(request, updateCommentSchema),
      ),
    });
  },
);

export const DELETE = createApiHandler(
  { route: "/api/comments/:id" },
  async (_request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { id } = await parseParams(context.params, commentIdSchema);
    await deleteComment(user.id, id);
    return noContent();
  },
);
