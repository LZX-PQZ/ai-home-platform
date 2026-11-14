import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../src/middleware";

test("页面门禁保留实际主机端口，失效/错角色/模拟会话及认证故障不能放行", async t => {
  let payload: unknown = { ok: true, data: { status: "signed_out" }, meta: { source: "live" } };
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: URL | string, init?: RequestInit) => {
    calls.push(String(url)); assert.equal(init?.cache, "no-store");
    assert.equal((init?.headers as { cookie: string }).cookie, "synthetic-cookie=opaque");
    return Response.json(payload);
  });
  const request = new NextRequest("http://127.0.0.1:3187/provider/orders?filter=open", {
    headers: { host: "127.0.0.1:3187", cookie: "synthetic-cookie=opaque" },
  });
  const denied = await middleware(request);
  assert.equal(denied.status, 307);
  const redirect = new URL(denied.headers.get("location")!);
  assert.equal(redirect.origin, "http://127.0.0.1:3187");
  assert.equal(redirect.pathname, "/login/provider");
  assert.equal(redirect.searchParams.get("next"), "/provider/orders?filter=open");
  assert.equal(calls[0], "http://127.0.0.1:3187/api/auth/provider");
  const valid = { status: "signed_in", identity: { userId: "synthetic", role: "provider", providerId: "p" }, expiresAt: "2030-01-01T00:00:00.000Z" };
  for (const invalid of [
    { ok: true, data: valid, meta: { source: "mock" } },
    { ok: false, data: valid, meta: { source: "live" } },
    { ok: true, data: { ...valid, identity: { userId: "admin", role: "admin", providerId: null } }, meta: { source: "live" } },
    { ok: true, data: {}, meta: { source: "live" } },
  ]) { payload = invalid; assert.equal((await middleware(request)).status, 307); }
  payload = { ok: true, data: valid, meta: { source: "live" } };
  assert.equal((await middleware(request)).status, 200);
  t.mock.method(globalThis, "fetch", async () => { throw new Error("unavailable"); });
  assert.equal((await middleware(request)).status, 307);
});
