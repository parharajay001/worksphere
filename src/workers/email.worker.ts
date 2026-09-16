import "server-only";
import "../config/load-env.ts";
import { QueueEvents, Worker } from "bullmq";
import { emailQueueName } from "../queue/contracts.ts";
import { queueConnection } from "../queue/connection.ts";
import { createEmailProcessor } from "./email.processor.ts";

const connection = queueConnection();
const worker = new Worker(emailQueueName, createEmailProcessor(), {
  connection,
  concurrency: 5,
});
const events = new QueueEvents(emailQueueName, { connection });

worker.on("completed", (job) => {
  console.log(
    JSON.stringify({
      level: "info",
      event: "job.completed",
      queue: emailQueueName,
      jobId: job.id,
      jobName: job.name,
    }),
  );
});
worker.on("error", () => {
  console.error(
    JSON.stringify({
      level: "error",
      event: "worker.error",
      queue: emailQueueName,
    }),
  );
});
events.on("failed", ({ jobId }) => {
  console.error(
    JSON.stringify({
      level: "error",
      event: "job.failed",
      queue: emailQueueName,
      jobId,
    }),
  );
});

async function shutdown(signal: string) {
  console.log(
    JSON.stringify({
      level: "info",
      event: "worker.stopping",
      queue: emailQueueName,
      signal,
    }),
  );
  await Promise.all([worker.close(), events.close()]);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void shutdown(signal).then(() => process.exit(0)));
}

console.log(
  JSON.stringify({
    level: "info",
    event: "worker.started",
    queue: emailQueueName,
    concurrency: 5,
  }),
);
