import { createApiHandler } from "@/lib/api/handler";
import { parseJson, parseParams, parseQuery } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { taskIdSchema } from "@/modules/tasks/task.schemas";
import {
  commentQuerySchema,
  createCommentSchema,
} from "@/modules/comments/comment.schemas";
import {
  createComment,
  listComments,
} from "@/modules/comments/comment.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function currentUser() {
  const user = await getSessionUser();
  if (!user) throw new AppError("UNAUTHENTICATED");
  return user;
}

export const GET = createApiHandler(
  { route: "/api/tasks/:id/comments" },
  async (request, context) => {
    const user = await currentUser();
    const { id } = await parseParams(context.params, taskIdSchema);
    return success(
      await listComments(
        user.id,
        id,
        await parseQuery(request, commentQuerySchema),
      ),
    );
  },
);

export const POST = createApiHandler(
  { route: "/api/tasks/:id/comments" },
  async (request, context) => {
    const user = await currentUser();
    const { id } = await parseParams(context.params, taskIdSchema);
    return success(
      {
        comment: await createComment(
          user.id,
          id,
          await parseJson(request, createCommentSchema),
        ),
      },
      { status: 201 },
    );
  },
);
