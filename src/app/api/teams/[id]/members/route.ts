import { createApiHandler } from "@/lib/api/handler";
import { parseJson, parseParams } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import {
  addTeamMemberSchema,
  teamIdSchema,
} from "@/modules/teams/team.schemas";
import { addTeamMember } from "@/modules/teams/team.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createApiHandler(
  { route: "/api/teams/:id/members" },
  async (request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { id } = await parseParams(context.params, teamIdSchema);
    const { userId } = await parseJson(request, addTeamMemberSchema);
    return success(
      { membership: await addTeamMember(user.id, id, userId) },
      { status: 201 },
    );
  },
);
