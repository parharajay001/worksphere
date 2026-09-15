import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "../src/modules/auth/password.ts";
import {
  loginSchema,
  registrationSchema,
} from "../src/modules/auth/auth.schemas.ts";
import { AppError } from "../src/lib/api/errors.ts";
import {
  clearAuthRateLimits,
  enforceAuthRateLimit,
} from "../src/modules/auth/rate-limit.ts";
import {
  hasPermission,
  permissionsForRole,
} from "../src/modules/authorization/permissions.ts";

test("password hashes are salted, non-reversible, and verify safely", async () => {
  const first = await hashPassword("correct horse battery staple");
  const second = await hashPassword("correct horse battery staple");
  assert.match(first, /^scrypt\$[^$]+\$[A-Za-z0-9_-]+$/);
  assert.notEqual(first, second);
  assert.equal(
    await verifyPassword("correct horse battery staple", first),
    true,
  );
  assert.equal(await verifyPassword("wrong password", first), false);
  assert.equal(
    await verifyPassword("correct horse battery staple", "plaintext-password"),
    false,
  );
  assert.equal(
    await verifyPassword("correct horse battery staple", "scrypt$bad$bad"),
    false,
  );
});

test("auth schemas normalize valid credentials and reject weak or unknown input", () => {
  assert.deepEqual(
    registrationSchema.parse({
      name: "  Ada Lovelace ",
      email: " ADA@EXAMPLE.COM ",
      password: "a secure password",
    }),
    {
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "a secure password",
    },
  );
  assert.deepEqual(
    loginSchema.parse({
      email: " ADA@EXAMPLE.COM ",
      password: "a secure password",
    }),
    { email: "ada@example.com", password: "a secure password" },
  );
  assert.throws(() =>
    registrationSchema.parse({ name: "", email: "bad", password: "short" }),
  );
  assert.throws(() =>
    loginSchema.parse({
      email: "ada@example.com",
      password: "a secure password",
      extra: true,
    }),
  );
});

test("sensitive auth actions are rate limited with a retry hint", () => {
  clearAuthRateLimits();
  for (let attempt = 0; attempt < 10; attempt += 1)
    enforceAuthRateLimit("login", "test-client");
  assert.throws(
    () => enforceAuthRateLimit("login", "test-client"),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "RATE_LIMITED" &&
      new Headers(error.headers).has("Retry-After"),
  );
  clearAuthRateLimits();
});

test("RBAC permission matrix grants least privilege by role", () => {
  assert.equal(hasPermission("OWNER", "organization:delete"), true);
  assert.equal(hasPermission("ADMIN", "organization:delete"), false);
  assert.equal(hasPermission("MANAGER", "projects:manage"), true);
  assert.equal(hasPermission("MEMBER", "projects:manage"), false);
  assert.equal(hasPermission("VIEWER", "organization:update"), false);
  assert.ok(
    permissionsForRole("OWNER").length > permissionsForRole("VIEWER").length,
  );
});
