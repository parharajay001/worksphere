import { z } from "zod";
import { createApiHandler } from "@/lib/api/handler";
import { noContent } from "@/lib/api/response";
import { parseParams } from "@/lib/api/validation";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { removeTeamMember } from "@/modules/teams/team.service";
const paramsSchema = z.strictObject({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const DELETE = createApiHandler(
  { route: "/api/teams/:id/members/:userId" },
  async (_request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { id, userId } = await parseParams(context.params, paramsSchema);
    await removeTeamMember(user.id, id, userId);
    return noContent();
  },
);
