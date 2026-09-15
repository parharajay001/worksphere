import { createApiHandler } from "@/lib/api/handler";
import { parseJson, parseParams } from "@/lib/api/validation";
import { noContent, success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import {
  projectIdSchema,
  updateProjectSchema,
} from "@/modules/projects/project.schemas";
import {
  deleteProject,
  getProject,
  updateProject,
} from "@/modules/projects/project.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function idOf(params: Parameters<typeof parseParams>[0]) {
  const { id } = await parseParams(params, projectIdSchema);
  return id;
}
export const GET = createApiHandler(
  { route: "/api/projects/:id" },
  async (_request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    return success({
      project: await getProject(user.id, await idOf(context.params)),
    });
  },
);
export const PATCH = createApiHandler(
  { route: "/api/projects/:id" },
  async (request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    return success({
      project: await updateProject(
        user.id,
        await idOf(context.params),
        await parseJson(request, updateProjectSchema),
      ),
    });
  },
);
export const DELETE = createApiHandler(
  { route: "/api/projects/:id" },
  async (_request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    await deleteProject(user.id, await idOf(context.params));
    return noContent();
  },
);
