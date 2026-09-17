import { createApiHandler } from "@/lib/api/handler";
import { parseJson, parseParams } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import {
  projectIdSchema,
  projectMemberSchema,
} from "@/modules/projects/project.schemas";
import {
  addProjectMember,
  listProjectMembers,
} from "@/modules/projects/project.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = createApiHandler(
  { route: "/api/projects/:id/members" },
  async (_request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { id } = await parseParams(context.params, projectIdSchema);
    return success({ members: await listProjectMembers(user.id, id) });
  },
);
export const POST = createApiHandler(
  { route: "/api/projects/:id/members" },
  async (request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { id } = await parseParams(context.params, projectIdSchema);
    const { userId } = await parseJson(request, projectMemberSchema);
    return success(
      { membership: await addProjectMember(user.id, id, userId) },
      { status: 201 },
    );
  },
);
