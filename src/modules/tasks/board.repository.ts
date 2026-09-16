import "server-only";
import type { Prisma } from "../../generated/prisma/client.ts";
import { AppError } from "../../lib/api/errors.ts";

// Updating the project row serializes all task writes until transaction commit.
export async function advanceBoard(
  tx: Prisma.TransactionClient,
  projectId: string,
  revision?: number,
) {
  const result = await tx.project.updateMany({
    where: {
      id: projectId,
      ...(revision === undefined ? {} : { boardRevision: revision }),
    },
    data: { boardRevision: { increment: 1 } },
  });
  if (result.count !== 1) throw new AppError("CONFLICT");
}

export async function nextPosition(
  tx: Prisma.TransactionClient,
  projectId: string,
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE",
) {
  const result = await tx.task.aggregate({
    where: { projectId, status },
    _max: { position: true },
  });
  return (result._max.position ?? -1) + 1;
}
