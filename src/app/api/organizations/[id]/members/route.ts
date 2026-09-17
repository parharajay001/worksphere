import { createApiHandler } from "@/lib/api/handler";
import { parseJson, parseParams } from "@/lib/api/validation";
import { noContent, success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { z } from "zod";
import {
  membershipRoleSchema,
  organizationIdSchema,
} from "@/modules/organizations/organization.schemas";
import {
  getOrganizationMembers,
  removeOrganizationMember,
  updateMemberRole,
} from "@/modules/organizations/organization.service";
const memberMutationSchema = z.strictObject({ userId: z.string().uuid() });
const roleMutationSchema = memberMutationSchema.extend({
  role: membershipRoleSchema,
});
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = createApiHandler(
  { route: "/api/organizations/:id/members" },
  async (_request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { id } = await parseParams(context.params, organizationIdSchema);
    return success({ members: await getOrganizationMembers(user.id, id) });
  },
);
export const PATCH = createApiHandler(
  { route: "/api/organizations/:id/members" },
  async (request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { id } = await parseParams(context.params, organizationIdSchema);
    const input = await parseJson(request, roleMutationSchema);
    return success({
      member: await updateMemberRole(user.id, id, input.userId, input.role),
    });
  },
);
export const DELETE = createApiHandler(
  { route: "/api/organizations/:id/members" },
  async (request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { id } = await parseParams(context.params, organizationIdSchema);
    const { userId } = await parseJson(request, memberMutationSchema);
    await removeOrganizationMember(user.id, id, userId);
    return noContent();
  },
);
