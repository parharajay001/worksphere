import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const portServer = createServer();
await new Promise((resolve, reject) => {
  portServer.once("error", reject);
  portServer.listen(0, "127.0.0.1", resolve);
});
const port = portServer.address().port;
await new Promise((resolve, reject) =>
  portServer.close((error) => (error ? reject(error) : resolve())),
);
const base = `http://127.0.0.1:${port}`;
let testEmail = "";
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
  { env: process.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
server.stderr.resume();
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null)
      throw new Error("Auth smoke server exited before startup.");
    try {
      if ((await fetch(`${base}/api/health`)).status === 200) {
        ready = true;
        break;
      }
    } catch {}
    await delay(100);
  }
  assert.ok(ready);
  const email = `day4-${randomUUID()}@worksphere.example`;
  testEmail = email;
  const password = "correct horse battery staple";
  let cookie = "";
  async function call(path, body, expected) {
    const response = await fetch(base + path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, expected, path);
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";", 1)[0];
    return { response, body: await response.json() };
  }
  const register = await call(
    "/api/auth/register",
    { name: "Day Four", email, password },
    201,
  );
  assert.equal(register.body.data.user.email, email);
  assert.ok(cookie.startsWith("worksphere_session="));
  assert.ok(!cookie.includes(password));
  const me = await (
    await fetch(`${base}/api/auth/me`, { headers: { cookie } })
  ).json();
  assert.equal(me.data.user.email, email);
  assert.equal(
    (
      await call(
        "/api/auth/register",
        { name: "Duplicate", email, password },
        409,
      )
    ).body.error.code,
    "CONFLICT",
  );
  await call("/api/auth/logout", {}, 200);
  const anonymous = await fetch(`${base}/api/auth/me`, { headers: { cookie } });
  assert.equal(anonymous.status, 401);
  assert.equal(
    (await call("/api/auth/login", { email, password }, 200)).body.data.user
      .email,
    email,
  );
  assert.equal(
    (await call("/api/auth/login", { email, password: "wrong password" }, 401))
      .body.error.code,
    "UNAUTHENTICATED",
  );
  const malformed = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "short" }),
  });
  assert.equal(malformed.status, 400);
  assert.ok(!(await malformed.text()).includes(password));
  console.log(
    "PASS: register, duplicate conflict, session cookie, current-user, logout, login, generic invalid credentials, and validation",
  );
} finally {
  server.kill();
  await new Promise((resolve) => server.once("close", resolve));
  if (testEmail) {
    const cleanup = spawnSync(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        "tsx",
        "scripts/cleanup-auth.mjs",
        testEmail,
      ],
      { env: process.env, encoding: "utf8", windowsHide: true },
    );
    assert.equal(
      cleanup.status,
      0,
      "Auth smoke cleanup must remove its test user",
    );
  }
}
