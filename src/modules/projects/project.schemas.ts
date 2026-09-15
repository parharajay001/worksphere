import { z } from "zod";
export const createProjectSchema = z.strictObject({
  organizationId: z.string().uuid(),
  teamId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
});
export const updateProjectSchema = z.strictObject({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
});
export const projectIdSchema = z.strictObject({ id: z.string().uuid() });
export const projectMemberSchema = z.strictObject({
  userId: z.string().uuid(),
});
