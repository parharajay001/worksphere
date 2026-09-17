import "server-only";
import { Prisma } from "../../generated/prisma/client.ts";
import { database } from "../../database/client.ts";
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
  return user ? issueAuthToken(user.id, "PASSWORD_RESET") : undefined;
}

export async function resendEmailVerification(userId: string) {
  return issueAuthToken(userId, "EMAIL_VERIFICATION");
}

export async function updateAccount(
  userId: string,
  input: { name?: string; currentPassword?: string; newPassword?: string },
) {
  const user = await database.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) throw new AppError("NOT_FOUND");
  if (
    input.newPassword &&
    (!input.currentPassword ||
      !(await verifyPassword(input.currentPassword, user.passwordHash)))
  )
    throw new AppError("UNAUTHENTICATED");
  const data: { name?: string; passwordHash?: string } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.newPassword)
    data.passwordHash = await hashPassword(input.newPassword);
  return database.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, name: true, emailVerifiedAt: true },
  });
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
