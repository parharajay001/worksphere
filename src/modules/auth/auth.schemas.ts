import { z } from "zod";

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(12).max(128);
export const passwordSchema = password;

export const registrationSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  email,
  password,
});

export const loginSchema = z.strictObject({ email, password });

export const tokenSchema = z.strictObject({
  token: z.string().min(40).max(128),
});
export const passwordResetSchema = z.strictObject({
  token: z.string().min(40).max(128),
  password,
});
export const emailSchema = z.strictObject({ email });
export const accountUpdateSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(100).optional(),
    currentPassword: password.optional(),
    newPassword: password.optional(),
  })
  .refine(
    (input) => input.name !== undefined || input.newPassword !== undefined,
    {
      message: "Provide a name or a new password.",
    },
  )
  .refine((input) => !input.newPassword || Boolean(input.currentPassword), {
    path: ["currentPassword"],
    message: "Enter your current password.",
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
