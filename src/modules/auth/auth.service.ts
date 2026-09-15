import "server-only";
import { Prisma } from "../../generated/prisma/client.ts";
import { AppError } from "../../lib/api/errors.ts";
import { createUser, findUserByEmail } from "./auth.repository.ts";
import { hashPassword, verifyPassword } from "./password.ts";
import { createSession } from "./session.ts";
import { issueAuthToken, resetPassword, verifyEmail } from "./auth.tokens.ts";
import type { LoginInput, RegistrationInput } from "./auth.schemas.ts";

const invalidCredentials = () => new AppError("UNAUTHENTICATED");

export async function register(input: RegistrationInput) {
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await createUser({
      email: input.email,
      name: input.name,
      passwordHash,
    });
    await issueAuthToken(user.id, "EMAIL_VERIFICATION");
    await createSession(user.id);
    return user;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError("CONFLICT");
    }
    throw error;
  }
}

export async function requestPasswordReset(email: string) {
  const user = await findUserByEmail(email);
  if (user) await issueAuthToken(user.id, "PASSWORD_RESET");
}

export { resetPassword, verifyEmail };

export async function login(input: LoginInput) {
  const user = await findUserByEmail(input.email);
  // Verify a real hash only when present. The generic response prevents account enumeration.
  if (!user || !(await verifyPassword(input.password, user.passwordHash)))
    throw invalidCredentials();
  await createSession(user.id);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerifiedAt: user.emailVerifiedAt,
  };
}
