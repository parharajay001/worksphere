import { createApiHandler } from "@/lib/api/handler";
import { parseJson, parseQuery } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import {
  createTaskSchema,
  taskFilterSchema,
} from "@/modules/tasks/task.schemas";
import { createTask, listTasks } from "@/modules/tasks/task.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function user() {
  const current = await getSessionUser();
  if (!current) throw new AppError("UNAUTHENTICATED");
  return current;
}
export const GET = createApiHandler({ route: "/api/tasks" }, async (request) =>
  success({
    tasks: await listTasks(
      (await user()).id,
      await parseQuery(request, taskFilterSchema),
    ),
  }),
);
export const POST = createApiHandler({ route: "/api/tasks" }, async (request) =>
  success(
    {
      task: await createTask(
        (await user()).id,
        await parseJson(request, createTaskSchema),
      ),
    },
    { status: 201 },
  ),
);
