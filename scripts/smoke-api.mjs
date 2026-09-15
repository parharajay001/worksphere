import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

if (!existsSync(".next/BUILD_ID"))
  throw new Error("Run npm run build before npm run test:api.");

async function unusedPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function withServer(environment, verify) {
  const port = await unusedPort();
  const base = `http://127.0.0.1:${port}`;
  const entries = [];
  let pending = "";
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      env: { ...process.env, ...environment },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const closed = new Promise((resolve) => server.once("close", resolve));
  server.stdout.on("data", (chunk) => {
    pending += chunk.toString();
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) {
      try {
        const value = JSON.parse(line);
        if (value.event === "http.request.completed") entries.push(value);
      } catch {
        /* Next.js startup output is not JSON. */
      }
    }
  });
  // Drain framework output. Assertions report safe, specific failures below.
  server.stderr.resume();
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null)
        throw new Error(
          "Production server exited before startup; check local environment configuration.",
        );
      try {
        const response = await fetch(`${base}/api/health`, {
          signal: AbortSignal.timeout(1000),
        });
        await response.arrayBuffer();
        if (response.status === 200) {
          ready = true;
          break;
        }
      } catch {
        /* Wait briefly for the server to bind. */
      }
      await delay(100);
    }
    assert.ok(ready, "Production server should become ready");
    await verify(base, entries);
  } finally {
    server.kill();
    await closed;
  }
}

async function request(base, path, status, code, init = {}) {
  const requestId = randomUUID();
  const response = await fetch(base + path, {
    ...init,
    headers: { "x-request-id": requestId, ...init.headers },
  });
  assert.equal(response.status, status, `${init.method ?? "GET"} ${path}`);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-request-id"), requestId);
  const text = await response.text();
  if (init.method === "HEAD" || status === 204) {
    assert.equal(text, "");
    return { response, requestId };
  }
  assert.match(response.headers.get("content-type"), /application\/json/);
  const body = JSON.parse(text);
  assert.equal(body.meta.requestId, requestId);
  if (code) assert.equal(body.error.code, code);
  else assert.equal(body.data.status, "ok");
  return { response, body, requestId };
}

await withServer({}, async (base, entries) => {
  const home = await fetch(base);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Good work starts/);
  const live = await request(base, "/api/health", 200);
  assert.equal(live.body.data.service, "worksphere");
  assert.ok(Number.isFinite(Date.parse(live.body.data.timestamp)));
  const database = await request(base, "/api/health?check=database", 200);
  assert.deepEqual(database.body.data.checks, { database: "ok" });
  await request(base, "/api/health?check=invalid", 400, "VALIDATION_ERROR");
  await request(
    base,
    "/api/health?check=live&check=database",
    400,
    "BAD_REQUEST",
  );
  await request(
    base,
    "/api/health?token=do-not-log-this",
    400,
    "VALIDATION_ERROR",
  );
  await request(
    base,
    "/api/do-not-log-this?password=do-not-log-this",
    404,
    "NOT_FOUND",
    {
      headers: {
        Authorization: "Bearer do-not-log-this",
        Cookie: "session=do-not-log-this",
      },
    },
  );
  await request(base, "/api", 404, "NOT_FOUND");
  const denied = await request(base, "/api/health", 405, "METHOD_NOT_ALLOWED", {
    method: "POST",
    body: "do-not-log-this",
  });
  assert.equal(denied.response.headers.get("allow"), "GET, HEAD, OPTIONS");
  await request(base, "/api/health", 200, undefined, { method: "HEAD" });
  await request(base, "/api/health?check=invalid", 400, undefined, {
    method: "HEAD",
  });
  const options = await request(base, "/api/health", 204, undefined, {
    method: "OPTIONS",
  });
  assert.equal(options.response.headers.get("allow"), "GET, HEAD, OPTIONS");
  const invalidId = await fetch(base + "/api/health", {
    headers: { "x-request-id": "do-not-log-this" },
  });
  assert.notEqual(invalidId.headers.get("x-request-id"), "do-not-log-this");
  assert.equal(
    (await invalidId.json()).meta.requestId,
    invalidId.headers.get("x-request-id"),
  );
  const parallel = await Promise.all(
    Array.from({ length: 5 }, () => request(base, "/api/health", 200)),
  );
  await delay(100);
  for (const { requestId } of [live, database, ...parallel]) {
    const matches = entries.filter((entry) => entry.requestId === requestId);
    assert.equal(matches.length, 1, "Exactly one completion log per request");
    assert.equal(matches[0].status, 200);
    assert.ok(Number.isFinite(matches[0].durationMs));
  }
  assert.ok(!JSON.stringify(entries).includes("do-not-log-this"));
  console.log(
    "PASS: production health/database, validation, 404/405, HEAD/OPTIONS, request IDs, concurrent logging, and payload redaction",
  );
});

const unavailablePort = await unusedPort();
await withServer(
  {
    DATABASE_URL: `postgresql://unavailable:do-not-log-this@127.0.0.1:${unavailablePort}/worksphere`,
  },
  async (base, entries) => {
    await request(base, "/api/health", 200);
    const failure = await request(
      base,
      "/api/health?check=database",
      503,
      "SERVICE_UNAVAILABLE",
    );
    assert.ok(!JSON.stringify(failure.body).includes("do-not-log-this"));
    await delay(100);
    const log = entries.find((entry) => entry.requestId === failure.requestId);
    assert.equal(log.level, "error");
    assert.equal(log.errorCode, "SERVICE_UNAVAILABLE");
    assert.ok(!JSON.stringify(entries).includes("do-not-log-this"));
    console.log(
      "PASS: unavailable database returns safe 503 while liveness remains healthy",
    );
  },
);
