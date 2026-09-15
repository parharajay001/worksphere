import assert from "node:assert/strict";
import test from "node:test";
import { parseEnvironment } from "../src/config/env.ts";

test("accepts local and deployed origins and strips unrelated environment variables", () => {
  assert.deepEqual(
    parseEnvironment({
      APP_URL: "http://localhost:3000",
      UNRELATED_SECRET: "private",
    }),
    {
      NODE_ENV: "development",
      APP_URL: "http://localhost:3000",
    },
  );
  assert.equal(
    parseEnvironment({
      APP_URL: "https://worksphere.example",
      NODE_ENV: "production",
    }).NODE_ENV,
    "production",
  );
});

test("rejects missing, empty, malformed, and non-HTTP origins", () => {
  for (const APP_URL of [
    undefined,
    "",
    "localhost:3000",
    "ftp://example.com",
    "https://example.com/path",
    "https://example.com/?query=1",
    "https://example.com/#fragment",
  ]) {
    assert.throws(
      () => parseEnvironment({ APP_URL }),
      /Invalid environment: APP_URL/,
    );
  }
});

test("rejects unsupported execution modes", () => {
  assert.throws(
    () =>
      parseEnvironment({
        APP_URL: "http://localhost:3000",
        NODE_ENV: "staging",
      }),
    /Invalid environment: NODE_ENV/,
  );
});

test("validation errors never echo secret-bearing values", () => {
  assert.throws(
    () =>
      parseEnvironment({ APP_URL: "https://user:super-secret@example.com" }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /APP_URL/);
      assert.ok(!error.message.includes("super-secret"));
      return true;
    },
  );
});
