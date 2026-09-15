import { createApiHandler } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { createTeamSchema } from "@/modules/teams/team.schemas";
import { createTeam, listTeams } from "@/modules/teams/team.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = createApiHandler(
  { route: "/api/teams" },
  async (request) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const organizationId = new URL(request.url).searchParams.get(
      "organizationId",
    );
    if (!organizationId) throw new AppError("VALIDATION_ERROR");
    return success({ teams: await listTeams(user.id, organizationId) });
  },
);
export const POST = createApiHandler(
  { route: "/api/teams" },
  async (request) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const input = await parseJson(request, createTeamSchema);
    return success(
      { team: await createTeam(user.id, input.organizationId, input.name) },
      { status: 201 },
    );
  },
);
