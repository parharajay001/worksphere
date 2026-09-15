import "server-only";
import { promisify } from "node:util";
import {
  randomBytes,
  timingSafeEqual,
  scrypt as scryptCallback,
} from "node:crypto";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(
  password: string,
  encoded: string | null,
): Promise<boolean> {
  if (!encoded?.startsWith("scrypt$")) return false;
  const [, saltText, hashText] = encoded.split("$");
  if (!saltText || !hashText) return false;
  try {
    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(hashText, "base64url");
    if (salt.length !== SALT_BYTES || expected.length !== KEY_LENGTH)
      return false;
    const actual = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
