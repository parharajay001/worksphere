import { z } from "zod";

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(12).max(128);

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

export type RegistrationInput = z.infer<typeof registrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
