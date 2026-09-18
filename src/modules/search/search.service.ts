import "server-only";
import { database } from "../../database/client.ts";
import { requirePermission } from "../authorization/guards.ts";
export async function searchWorkspace(
  userId: string,
  organizationId: string,
  query: string,
) {
  await requirePermission(userId, organizationId, "organization:read");
  const [projects, tasks] = await Promise.all([
    database.project.findMany({
      where: {
        organizationId,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, name: true, description: true, status: true },
    }),
    database.task.findMany({
      where: {
        project: { organizationId },
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        project: { select: { id: true, name: true } },
      },
    }),
  ]);
  return { projects, tasks };
}
