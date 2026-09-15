import { z } from "zod";
export const createTeamSchema = z.strictObject({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
});
export const teamIdSchema = z.strictObject({ id: z.string().uuid() });
export const addTeamMemberSchema = z.strictObject({
  userId: z.string().uuid(),
});
