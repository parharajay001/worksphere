import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { z } from "zod";
import { AppError } from "../src/lib/api/errors.ts";
import { createApiHandler } from "../src/lib/api/handler.ts";
import { success, noContent } from "../src/lib/api/response.ts";
import { getRequestId } from "../src/lib/api/request-id.ts";
import {
  parseInput,
  parseJson,
  parseParams,
  parseQuery,
} from "../src/lib/api/validation.ts";
import {
  writeRequestLog,
  type RequestLog,
} from "../src/lib/logging/request-logger.ts";
import { createHealthService } from "../src/modules/health/health.service.ts";
import { healthQuerySchema } from "../src/modules/health/health.schema.ts";

const jsonRequest = (
  body: string,
  headers: HeadersInit = { "content-type": "application/json" },
) =>
  new Request("http://localhost/api/example", {
    method: "POST",
    headers,
    body,
  });
const hasCode = (code: AppError["code"]) => (error: unknown) =>
  error instanceof AppError && error.code === code;

test("success responses correlate body, header, and completion log", async () => {
  const logs: RequestLog[] = [];
  const requestId = randomUUID();
  const handler = createApiHandler(
    { route: "/api/example", log: (entry) => logs.push(entry) },
    () =>
      success(
        { id: 1 },
        { status: 201, headers: { Location: "/api/example/1" } },
      ),
  );
  const response = await handler(
    new Request("http://localhost/api/example?token=never-log", {
      headers: { "x-request-id": requestId },
    }),
  );
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("location"), "/api/example/1");
  assert.equal(response.headers.get("x-request-id"), requestId);
  assert.deepEqual(await response.json(), {
    data: { id: 1 },
    meta: { requestId },
  });
  assert.equal(logs.length, 1);
  assert.equal(logs[0]?.requestId, requestId);
  assert.equal(logs[0]?.status, 201);
  assert.ok(Number.isFinite(logs[0]?.durationMs));
  assert.ok(!JSON.stringify(logs).includes("never-log"));
});

test("typed errors preserve safe status, headers, and codes", async () => {
  for (const [code, status] of [
    ["UNAUTHENTICATED", 401],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
    ["RATE_LIMITED", 429],
    ["SERVICE_UNAVAILABLE", 503],
  ] as const) {
    const handler = createApiHandler(
      { route: "/api/example", log: () => {} },
      () => {
        throw new AppError(code, {
          cause: new Error("private cause"),
          headers: { "Retry-After": "10" },
        });
      },
    );
    const response = await handler(new Request("http://localhost/api/example"));
    const body = await response.json();
    assert.equal(response.status, status);
    assert.equal(body.error.code, code);
    assert.equal(body.meta.requestId, response.headers.get("x-request-id"));
    assert.equal(response.headers.get("retry-after"), "10");
    assert.ok(!JSON.stringify(body).includes("private cause"));
  }
});

test("unexpected exceptions and serialization failures become opaque 500 responses", async () => {
  for (const fail of [
    () => {
      throw new Error("postgres://user:super-secret@host/database");
    },
    () => {
      throw "secret thrown string";
    },
    () => success({ impossibleJson: BigInt(1) }),
  ]) {
    const logs: RequestLog[] = [];
    const response = await createApiHandler(
      { route: "/api/example", log: (entry) => logs.push(entry) },
      fail,
    )(new Request("http://localhost/api/example"));
    assert.equal(response.status, 500);
    assert.deepEqual((await response.json()).error, {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
    });
    assert.equal(logs[0]?.errorCode, "INTERNAL_ERROR");
    assert.ok(!JSON.stringify(logs).includes("secret"));
  }
});

test("HEAD suppresses success and error bodies; 204 carries no JSON", async () => {
  for (const action of [
    () => success({ ok: true }),
    () => {
      throw new AppError("NOT_FOUND");
    },
  ]) {
    const response = await createApiHandler(
      { route: "/api/example", log: () => {} },
      action,
    )(new Request("http://localhost/api/example", { method: "HEAD" }));
    assert.equal(await response.text(), "");
    assert.ok(response.headers.get("x-request-id"));
  }
  const response = await createApiHandler(
    { route: "/api/example", log: () => {} },
    () => noContent({ Allow: "GET, HEAD, OPTIONS" }),
  )(new Request("http://localhost/api/example", { method: "OPTIONS" }));
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.get("allow"), "GET, HEAD, OPTIONS");
});

test("invalid request IDs are replaced and concurrent request contexts stay isolated", async () => {
  for (const invalid of ["token-secret", "x".repeat(300), "not-a-uuid"]) {
    const id = getRequestId(
      new Request("http://localhost", { headers: { "x-request-id": invalid } }),
    );
    assert.notEqual(id, invalid);
    assert.ok(z.uuid().safeParse(id).success);
  }
  assert.notEqual(
    getRequestId(new Request("http://localhost")),
    getRequestId(new Request("http://localhost")),
  );
  const logs: RequestLog[] = [];
  const ids = Array.from({ length: 10 }, () => randomUUID());
  const handler = createApiHandler(
    { route: "/api/example", log: (entry) => logs.push(entry) },
    async (_request, context) => {
      await Promise.resolve();
      return success({ id: context.requestId });
    },
  );
  await Promise.all(
    ids.map(async (id) => {
      const response = await handler(
        new Request("http://localhost/api/example", {
          headers: { "x-request-id": id },
        }),
      );
      assert.deepEqual(await response.json(), {
        data: { id },
        meta: { requestId: id },
      });
    }),
  );
  assert.deepEqual(logs.map((entry) => entry.requestId).sort(), ids.sort());
});

test("JSON logs only contain allowlisted metadata, including on errors", (context) => {
  const output: string[] = [];
  context.mock.method(console, "log", (line: string) => output.push(line));
  const entry = {
    requestId: randomUUID(),
    route: "/api/example/[id]",
    method: "POST",
    status: 500,
    durationMs: 3,
    errorCode: "INTERNAL_ERROR" as const,
    password: "never-log",
    headers: { cookie: "never-log" },
    error: new Error("never-log"),
  };
  writeRequestLog(entry);
  const logged = JSON.parse(output[0]!);
  assert.equal(logged.level, "error");
  assert.equal(logged.event, "http.request.completed");
  assert.deepEqual(
    Object.keys(logged).sort(),
    [
      "timestamp",
      "level",
      "event",
      "requestId",
      "route",
      "method",
      "status",
      "durationMs",
      "errorCode",
    ].sort(),
  );
  assert.ok(!output[0]?.includes("never-log"));
});

test("a failing log writer does not turn completed work into an error response", async (context) => {
  const output: string[] = [];
  context.mock.method(console, "error", (line: string) => output.push(line));
  const response = await createApiHandler(
    {
      route: "/api/example",
      log: () => {
        throw new Error("sink secret");
      },
    },
    () => success({ completed: true }),
  )(new Request("http://localhost/api/example"));
  assert.equal(response.status, 200);
  assert.equal(output.length, 1);
  assert.ok(!output[0]?.includes("sink secret"));
});

test("schema validation supports typed transformations, defaults, and async refinements", async () => {
  const schema = z.strictObject({
    name: z
      .string()
      .trim()
      .min(1)
      .refine(async (value) => value !== "blocked"),
    page: z.coerce.number().int().min(1).default(1),
  });
  assert.deepEqual(await parseInput(schema, { name: "  Ada  " }), {
    name: "Ada",
    page: 1,
  });
  await assert.rejects(
    parseInput(schema, { name: "blocked" }),
    hasCode("VALIDATION_ERROR"),
  );
  assert.deepEqual(
    await parseParams(
      Promise.resolve({ id: "123" }),
      z.object({ id: z.coerce.number() }),
    ),
    { id: 123 },
  );
});

test("validation errors omit submitted values and custom schema messages", async () => {
  const schema = z.strictObject({
    password: z.string().refine(() => false, "secret-value must never leak"),
  });
  const handler = createApiHandler(
    { route: "/api/example", log: () => {} },
    async (request) => success(await parseJson(request, schema)),
  );
  const response = await handler(jsonRequest('{"password":"secret-value"}'));
  assert.equal(response.status, 400);
  const text = await response.text();
  assert.ok(!text.includes("secret-value"));
  assert.deepEqual(JSON.parse(text).error.details, [
    { path: "password", code: "custom", message: "Invalid value." },
  ]);
});

test("query validation rejects duplicate keys, unknown fields, and unsafe prototype keys", async () => {
  assert.deepEqual(
    await parseQuery(
      new Request("http://localhost/api/health"),
      healthQuerySchema,
    ),
    { check: "live" },
  );
  await assert.rejects(
    parseQuery(
      new Request("http://localhost/api/health?check=live&check=database"),
      healthQuerySchema,
    ),
    hasCode("BAD_REQUEST"),
  );
  for (const query of ["check=other", "token=private", "__proto__=polluted"]) {
    await assert.rejects(
      parseQuery(
        new Request(`http://localhost/api/health?${query}`),
        healthQuerySchema,
      ),
      hasCode("VALIDATION_ERROR"),
    );
  }
});

test("JSON parsing accepts JSON media types and rejects malformed or wrong content", async () => {
  const schema = z.strictObject({ name: z.string() });
  for (const type of [
    "application/json; charset=utf-8",
    "application/vnd.worksphere+json",
    "APPLICATION/JSON",
  ]) {
    assert.deepEqual(
      await parseJson(
        jsonRequest('{"name":"Ada"}', { "content-type": type }),
        schema,
      ),
      { name: "Ada" },
    );
  }
  await assert.rejects(
    parseJson(jsonRequest("{}", {}), schema),
    hasCode("UNSUPPORTED_MEDIA_TYPE"),
  );
  await assert.rejects(
    parseJson(jsonRequest("{}", { "content-type": "text/plain" }), schema),
    hasCode("UNSUPPORTED_MEDIA_TYPE"),
  );
  for (const body of ["", "{", "{unquoted:1}"]) {
    await assert.rejects(
      parseJson(jsonRequest(body), schema),
      hasCode("INVALID_JSON"),
    );
  }
  await assert.rejects(
    parseJson(jsonRequest("null"), schema),
    hasCode("VALIDATION_ERROR"),
  );
  await assert.rejects(
    parseJson(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: new Uint8Array([0xff]),
      }),
      schema,
    ),
    hasCode("INVALID_JSON"),
  );
});

test("JSON body limits count actual bytes regardless of Content-Length", async () => {
  const schema = z.unknown();
  await assert.rejects(
    parseJson(
      jsonRequest("{}", {
        "content-type": "application/json",
        "content-length": "999999",
      }),
      schema,
    ),
    hasCode("PAYLOAD_TOO_LARGE"),
  );
  await assert.rejects(
    parseJson(
      jsonRequest('"🌍"', {
        "content-type": "application/json",
        "content-length": "1",
      }),
      schema,
      5,
    ),
    hasCode("PAYLOAD_TOO_LARGE"),
  );
  assert.equal(await parseJson(jsonRequest('"🌍"'), schema, 6), "🌍");
  await assert.rejects(
    parseJson(
      jsonRequest("{}", {
        "content-type": "application/json",
        "content-length": "invalid",
      }),
      schema,
    ),
    hasCode("BAD_REQUEST"),
  );
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("123456"));
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request("http://localhost", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: stream,
    duplex: "half",
  } as RequestInit);
  await assert.rejects(
    parseJson(request, schema, 5),
    hasCode("PAYLOAD_TOO_LARGE"),
  );
  assert.equal(cancelled, true);
});

test("liveness avoids the repository; database failures become safe 503 errors", async () => {
  let calls = 0;
  const getHealth = createHealthService({
    checkDatabase: async () => {
      calls++;
      throw new Error("database-password-secret");
    },
  });
  assert.equal((await getHealth({ check: "live" })).status, "ok");
  assert.equal(calls, 0);
  await assert.rejects(
    getHealth({ check: "database" }),
    hasCode("SERVICE_UNAVAILABLE"),
  );
  assert.equal(calls, 1);
  const successful = createHealthService({ checkDatabase: async () => {} });
  assert.deepEqual((await successful({ check: "database" })).checks, {
    database: "ok",
  });
});

test("invalid input is rejected before a service can perform work", async () => {
  let calls = 0;
  const getHealth = createHealthService({
    checkDatabase: async () => {
      calls++;
    },
  });
  const handler = createApiHandler(
    { route: "/api/health", log: () => {} },
    async (request) =>
      success(await getHealth(await parseQuery(request, healthQuerySchema))),
  );
  const response = await handler(
    new Request("http://localhost/api/health?check=invalid"),
  );
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});
