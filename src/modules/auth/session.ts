import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { database } from "../../database/client.ts";
import {
  SESSION_COOKIE,
  SESSION_TOKEN_BYTES,
  SESSION_TTL_SECONDS,
} from "./auth.constants.ts";

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
  await database.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
    },
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    priority: "high",
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await database.session.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    priority: "high",
  });
}

export async function getSessionUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length < 40 || token.length > 64) return null;
  const session = await database.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      expiresAt: true,
      user: {
        select: { id: true, name: true, email: true, emailVerifiedAt: true },
      },
    },
  });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await database.session.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
    return null;
  }
  return session.user;
}
