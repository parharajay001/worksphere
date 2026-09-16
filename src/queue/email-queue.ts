import "server-only";
import { Queue } from "bullmq";
import { emailQueueName, type EmailJobMap } from "./contracts.ts";
import { queueConnection } from "./connection.ts";

type QueueWriter = Pick<Queue, "add">;

let queue: Queue | undefined;

export const emailJobDefaults = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 1_000 },
  removeOnComplete: { age: 86_400, count: 1_000 },
  // Exhausted jobs are the dead-letter record and remain inspectable.
  removeOnFail: false,
};

export function getEmailQueue() {
  return (queue ??= new Queue(emailQueueName, {
    connection: queueConnection(),
    defaultJobOptions: emailJobDefaults,
  }));
}

export async function enqueueEmailJob<K extends keyof EmailJobMap>(
  name: K,
  data: EmailJobMap[K],
  idempotencyKey: string,
  writer: QueueWriter = getEmailQueue(),
) {
  return writer.add(name, data, { jobId: idempotencyKey });
}

export function enqueueInvitationEmail(data: EmailJobMap["invitation.email"]) {
  return enqueueEmailJob(
    "invitation.email",
    data,
    `invitation-email-${data.invitationId}`,
  );
}

export async function closeEmailQueue() {
  await queue?.close();
  queue = undefined;
}
