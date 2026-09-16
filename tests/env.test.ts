import assert from "node:assert/strict";
import test from "node:test";
import {
  parseDatabaseEnvironment,
  parseEnvironment,
} from "../src/config/env.ts";
import { parseRedisEnvironment } from "../src/config/redis.ts";

const DATABASE_URL =
  "postgresql://local:local@localhost:54329/worksphere?schema=public";

test("accepts local and deployed origins and strips unrelated environment variables", () => {
  assert.deepEqual(
    parseEnvironment({
      APP_URL: "http://localhost:3000",
      DATABASE_URL,
      UNRELATED_SECRET: "private",
    }),
    {
      NODE_ENV: "development",
      DATABASE_URL,
      APP_URL: "http://localhost:3000",
    },
  );
  assert.equal(
    parseEnvironment({
      APP_URL: "https://worksphere.example",
      DATABASE_URL,
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
      () => parseEnvironment({ APP_URL, DATABASE_URL }),
      /Invalid environment: APP_URL/,
    );
  }
});

test("rejects unsupported execution modes", () => {
  assert.throws(
    () =>
      parseEnvironment({
        APP_URL: "http://localhost:3000",
        DATABASE_URL,
        NODE_ENV: "staging",
      }),
    /Invalid environment: NODE_ENV/,
  );
});

test("validation errors never echo secret-bearing values", () => {
  assert.throws(
    () =>
      parseEnvironment({
        APP_URL: "https://user:super-secret@example.com",
        DATABASE_URL,
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /APP_URL/);
      assert.ok(!error.message.includes("super-secret"));
      return true;
    },
  );
});

test("accepts PostgreSQL URLs independently of app configuration", () => {
  assert.deepEqual(parseDatabaseEnvironment({ DATABASE_URL }), {
    DATABASE_URL,
  });
  assert.equal(
    parseDatabaseEnvironment({
      DATABASE_URL: "postgres://local@localhost/worksphere",
    }).DATABASE_URL,
    "postgres://local@localhost/worksphere",
  );
});

test("rejects missing, malformed, non-Postgres, and incomplete database URLs", () => {
  for (const value of [
    undefined,
    "",
    "invalid",
    "https://user:secret@localhost/database",
    "postgresql://localhost/database",
    "postgresql://user:secret@localhost/",
    "postgresql://user:secret@localhost/db?schema=bad-name",
  ]) {
    assert.throws(
      () => parseDatabaseEnvironment({ DATABASE_URL: value }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Invalid environment: DATABASE_URL/);
        assert.ok(!error.message.includes("secret"));
        return true;
      },
    );
  }
});

test("accepts Redis URL configuration and provides a local default", () => {
  assert.deepEqual(parseRedisEnvironment({}), {
    REDIS_URL: "redis://localhost:6379",
  });
  assert.equal(
    parseRedisEnvironment({ REDIS_URL: "rediss://cache.example:6380" })
      .REDIS_URL,
    "rediss://cache.example:6380",
  );
  assert.throws(
    () => parseRedisEnvironment({ REDIS_URL: "https://cache.example" }),
    /Invalid environment: REDIS_URL/,
  );
});
