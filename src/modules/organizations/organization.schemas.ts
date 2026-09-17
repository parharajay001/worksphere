import { z } from "zod";

export const organizationIdSchema = z.strictObject({ id: z.string().uuid() });
export const createOrganizationSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(63)
    .optional(),
});
export const updateOrganizationSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(100).optional(),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(63)
      .optional(),
  })
  .refine((input) => input.name !== undefined || input.slug !== undefined, {
    message: "Provide a name or slug.",
  });
export const activeOrganizationSchema = organizationIdSchema;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
