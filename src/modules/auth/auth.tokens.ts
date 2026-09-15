import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { database } from "../../database/client.ts";
import { AppError } from "../../lib/api/errors.ts";
import type { AuthTokenType } from "../../generated/prisma/client.ts";
import { hashPassword } from "./password.ts";

const TTL = {
  EMAIL_VERIFICATION: 24 * 60 * 60,
  PASSWORD_RESET: 60 * 60,
} as const;
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function issueAuthToken(userId: string, type: AuthTokenType) {
  const token = randomBytes(32).toString("base64url");
  await database.authToken.deleteMany({ where: { userId, type } });
  await database.authToken.create({
    data: {
      userId,
      type,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + TTL[type] * 1000),
    },
  });
  return token;
}

async function consume(token: string, type: AuthTokenType) {
  const record = await database.authToken.findUnique({
    where: { tokenHash: hash(token) },
  });
  if (
    !record ||
    record.type !== type ||
    record.consumedAt ||
    record.expiresAt <= new Date()
  )
    throw new AppError("BAD_REQUEST");
  await database.authToken.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });
  return record.userId;
}

export async function verifyEmail(token: string) {
  const userId = await consume(token, "EMAIL_VERIFICATION");
  return database.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: new Date() },
    select: { id: true, email: true, name: true, emailVerifiedAt: true },
  });
}

export async function resetPassword(token: string, password: string) {
  const userId = await consume(token, "PASSWORD_RESET");
  const passwordHash = await hashPassword(password);
  await database.$transaction([
    database.user.update({ where: { id: userId }, data: { passwordHash } }),
    database.session.deleteMany({ where: { userId } }),
  ]);
}
