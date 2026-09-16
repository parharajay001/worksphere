import "server-only";
import { database } from "../database/client.ts";
import { roomName, type RoomTarget } from "./contracts.ts";

type RoomLookups = {
  organizationMember(userId: string, organizationId: string): Promise<boolean>;
  projectOrganization(projectId: string): Promise<string | null>;
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
};

export async function authorizeRealtimeRoom(
  userId: string,
  target: RoomTarget,
  lookups: RoomLookups = databaseLookups,
) {
  const organizationId =
    target.kind === "organization"
      ? target.id
      : await lookups.projectOrganization(target.id);
  if (!organizationId) return null;
  if (!(await lookups.organizationMember(userId, organizationId))) return null;
  return target.kind === "organization"
    ? roomName.organization(target.id)
    : roomName.project(target.id);
}
