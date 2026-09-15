import "server-only";
import { database } from "../../database/client.ts";

export async function listForUser(userId: string) {
  return database.membership.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      organization: { select: { id: true, name: true, slug: true } },
    },
  });
}
export async function findMembership(userId: string, organizationId: string) {
  return database.membership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: {
      role: true,
      organization: { select: { id: true, name: true, slug: true } },
    },
  });
}
