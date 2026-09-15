import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "../src/modules/auth/password.ts";
import {
  loginSchema,
  registrationSchema,
} from "../src/modules/auth/auth.schemas.ts";

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
