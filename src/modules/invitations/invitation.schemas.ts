import { z } from "zod";
import { emailSchema } from "../auth/auth.schemas.ts";
import { organizationIdSchema } from "../organizations/organization.schemas.ts";
export const createInvitationSchema = z.strictObject({
  organizationId: organizationIdSchema.shape.id,
  email: emailSchema.shape.email,
  role: z.enum(["ADMIN", "MANAGER", "MEMBER", "VIEWER"]).default("MEMBER"),
});
export const invitationTokenSchema = z.strictObject({
  token: z.string().min(40).max(128),
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
