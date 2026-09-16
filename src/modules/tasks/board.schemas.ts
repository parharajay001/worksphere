import { z } from "zod";
import { taskStatuses } from "./board.ts";

export const moveTaskSchema = z.strictObject({
  taskId: z.string().uuid(),
  status: z.enum(taskStatuses),
  index: z.number().int().min(0).max(2147483647),
  revision: z.number().int().min(0).max(2147483646),
});
