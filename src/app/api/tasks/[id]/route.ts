import { createApiHandler } from "@/lib/api/handler";
import { parseJson, parseParams } from "@/lib/api/validation";
import { noContent, success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { taskIdSchema, updateTaskSchema } from "@/modules/tasks/task.schemas";
import { deleteTask, getTask, updateTask } from "@/modules/tasks/task.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = createApiHandler(
  { route: "/api/tasks/:id" },
  async (_request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { id } = await parseParams(context.params, taskIdSchema);
    return success({ task: await getTask(user.id, id) });
  },
);
export const PATCH = createApiHandler(
  { route: "/api/tasks/:id" },
  async (request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { id } = await parseParams(context.params, taskIdSchema);
    return success({
      task: await updateTask(
        user.id,
        id,
        await parseJson(request, updateTaskSchema),
      ),
    });
  },
);
export const DELETE = createApiHandler(
  { route: "/api/tasks/:id" },
  async (_request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { id } = await parseParams(context.params, taskIdSchema);
    await deleteTask(user.id, id);
    return noContent();
  },
);
