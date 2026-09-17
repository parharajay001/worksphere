import { createApiHandler } from "@/lib/api/handler";
import { noContent, success } from "@/lib/api/response";
import { parseJson, parseParams } from "@/lib/api/validation";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { teamIdSchema, updateTeamSchema } from "@/modules/teams/team.schemas";
import { deleteTeam, updateTeam } from "@/modules/teams/team.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function current() {
  const user = await getSessionUser();
  if (!user) throw new AppError("UNAUTHENTICATED");
  return user;
}
export const PATCH = createApiHandler(
  { route: "/api/teams/:id" },
  async (request, context) => {
    const user = await current();
    const { id } = await parseParams(context.params, teamIdSchema);
    const { name } = await parseJson(request, updateTeamSchema);
    return success({ team: await updateTeam(user.id, id, name) });
  },
);
export const DELETE = createApiHandler(
  { route: "/api/teams/:id" },
  async (_request, context) => {
    const user = await current();
    const { id } = await parseParams(context.params, teamIdSchema);
    await deleteTeam(user.id, id);
    return noContent();
  },
);
