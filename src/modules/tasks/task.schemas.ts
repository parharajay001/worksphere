import { z } from "zod";
export const createTaskSchema = z.strictObject({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
});
export const updateTaskSchema = createTaskSchema
  .omit({ projectId: true })
  .partial();
export const taskIdSchema = z.strictObject({ id: z.string().uuid() });
export const taskFilterSchema = z
  .object({
    projectId: z.string().uuid(),
    status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    assigneeId: z.string().uuid().optional(),
  })
  .strict();
