import { createApiHandler } from "@/lib/api/handler";
import { parseJson, parseParams } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { taskIdSchema } from "@/modules/tasks/task.schemas";
import { moveTaskSchema } from "@/modules/tasks/board.schemas";
import { getBoard, moveTask } from "@/modules/tasks/board.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = createApiHandler(
  { route: "/api/projects/:id/board" },
  async (_request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { id } = await parseParams(context.params, taskIdSchema);
    return success({ board: await getBoard(user.id, id) });
  },
);
export const PATCH = createApiHandler(
  { route: "/api/projects/:id/board" },
  async (request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { id } = await parseParams(context.params, taskIdSchema);
    return success({
      board: await moveTask(
        user.id,
        id,
        await parseJson(request, moveTaskSchema),
      ),
    });
  },
);
