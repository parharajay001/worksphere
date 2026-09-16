import "server-only";
import { database } from "../database/client.ts";
import { roomName, type RoomTarget } from "./contracts.ts";

type RoomLookups = {
  organizationMember(userId: string, organizationId: string): Promise<boolean>;
  projectOrganization(projectId: string): Promise<string | null>;
  teamAccess(userId: string, teamId: string): Promise<string | null>;
};

const databaseLookups: RoomLookups = {
  async organizationMember(userId, organizationId) {
    return Boolean(
      await database.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
        select: { id: true },
      }),
    );
  },
  async projectOrganization(projectId) {
    const project = await database.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    return project?.organizationId ?? null;
  },
  async teamAccess(userId, teamId) {
    const team = await database.team.findUnique({
      where: { id: teamId },
      select: {
        organizationId: true,
        memberships: { where: { userId }, select: { id: true }, take: 1 },
        organization: {
          select: {
            memberships: {
              where: { userId, role: { in: ["OWNER", "ADMIN", "MANAGER"] } },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });
    return team &&
      (team.memberships.length > 0 || team.organization.memberships.length > 0)
      ? team.organizationId
      : null;
  },
};

export async function authorizeRealtimeRoom(
  userId: string,
  target: RoomTarget,
  lookups: RoomLookups = databaseLookups,
) {
  const organizationId =
    target.kind === "organization"
      ? target.id
      : target.kind === "project"
        ? await lookups.projectOrganization(target.id)
        : await lookups.teamAccess(userId, target.id);
  if (!organizationId) return null;
  if (!(await lookups.organizationMember(userId, organizationId))) return null;
  return roomName[target.kind](target.id);
}
