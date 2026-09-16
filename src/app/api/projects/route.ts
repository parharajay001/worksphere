import { createApiHandler } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { createProjectSchema } from "@/modules/projects/project.schemas";
import {
  createProject,
  listProjectsWithCache,
} from "@/modules/projects/project.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function current() {
  const user = await getSessionUser();
  if (!user) throw new AppError("UNAUTHENTICATED");
  return user;
}
export const GET = createApiHandler(
  { route: "/api/projects" },
  async (request) => {
    const user = await current();
    const organizationId = new URL(request.url).searchParams.get(
      "organizationId",
    );
    if (!organizationId) throw new AppError("VALIDATION_ERROR");
    return success(await listProjectsWithCache(user.id, organizationId));
  },
);
export const POST = createApiHandler(
  { route: "/api/projects" },
  async (request) => {
    const user = await current();
    return success(
      {
        project: await createProject(
          user.id,
          await parseJson(request, createProjectSchema),
        ),
      },
      { status: 201 },
    );
  },
);
