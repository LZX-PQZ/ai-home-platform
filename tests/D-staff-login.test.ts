import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { DEMO_PROVIDER_ID, DEMO_PROVIDER_USER_ID } from "../src/contracts";
import { provisionRoadshowAccounts } from "../src/lib/roadshow-accounts";
import { createStaffSessionHandlers } from "../src/lib/staff-session-handlers";
import { createOwnerSessionHandlers } from "../src/lib/owner-session-handlers";
import { readDemoVerifiedSession } from "../src/lib/demo-provider-session";
import { readStaffSession, STAFF_SESSION_COOKIE } from "../src/lib/staff-session";

test("三端密码会话：角色隔离、失效拒绝、退出、互斥与预置账号不覆盖", async t => {
  const folder = mkdtempSync(join(tmpdir(), "ai-home-D-staff-"));
  writeFileSync(join(folder, "auth.db"), "");
  const databaseUrl = `file:${join(folder, "auth.db").replaceAll("\\", "/")}`;
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  t.after(async () => { await db.$disconnect(); rmSync(folder, { recursive: true, force: true }); });
  execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "db", "push", "--schema", resolve("prisma/schema.prisma"), "--skip-generate"], {
    env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe", timeout: 30000,
  });
  await db.serviceProvider.create({ data: { id: DEMO_PROVIDER_ID, name: "Synthetic provider", city: "深圳", kind: "construction", tagsJson: "[]" } });
  await db.user.create({ data: { id: DEMO_PROVIDER_USER_ID, name: "Synthetic provider", role: "provider", providerId: DEMO_PROVIDER_ID } });
  const passwords = { owner: "Synthetic owner password 42!", provider: "Synthetic provider password 42!", admin: "Synthetic admin password 42!" };
  const accounts = await provisionRoadshowAccounts(db, passwords);
  const initialCount = await db.user.count();
  await assert.rejects(provisionRoadshowAccounts(db, passwords));
  assert.equal(await db.user.count(), initialCount, "重复准备必须整笔回滚，不能覆盖或多建账号");
  let now = new Date();
  const provider = createStaffSessionHandlers("provider", db, () => now);
  const admin = createStaffSessionHandlers("admin", db, () => now);
  const owner = createOwnerSessionHandlers(db, () => now);
  function req(method = "GET", cookie = "", body?: unknown, origin = "https://example.test") {
    return new Request("https://example.test/api/auth/provider", { method, headers: { cookie, origin, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  const credentials = (role: keyof typeof passwords) => ({ login: `roadshow.${role}`, password: passwords[role] });
  const cookie = (response: Response) => response.headers.getSetCookie()[0].split(";")[0];
  async function signedIn(api: typeof provider, role: "provider" | "admin", previous = "") {
    const response = await api.POST(req("POST", previous, credentials(role)));
    assert.equal(response.status, 200);
    assert.match(response.headers.getSetCookie()[0], /HttpOnly; Secure; SameSite=Strict/);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const body = await response.json(); assert.equal(body.data.identity.role, role); assert.equal(body.meta.source, "live");
    assert.doesNotMatch(JSON.stringify(body), /password|tokenHash|credentialHash/);
    return cookie(response);
  }
  for (const role of ["admin", "owner"] as const) {
    const response = await provider.POST(req("POST", "", credentials(role)));
    assert.equal(response.status, 401); assert.equal((await response.json()).error.code, "INVALID_CREDENTIALS");
  }
  assert.equal((await provider.POST(req("POST", "", credentials("provider"), "https://evil.test"))).status, 403);
  assert.equal((await provider.POST(req("POST", "", { ...credentials("provider"), role: "admin" }))).status, 400);
  assert.equal((await provider.POST(req("POST", "", { ...credentials("provider"), password: "Wrong password 0000" }))).status, 401);
  const providerCookie = await signedIn(provider, "provider");
  assert.equal((await readStaffSession(req("GET", providerCookie), db, now)).status, "signed_in");
  assert.equal((await (await admin.GET(req("GET", providerCookie))).json()).data.status, "signed_out");
  assert.equal((await readDemoVerifiedSession(req("GET", providerCookie), db))?.providerId, DEMO_PROVIDER_ID);
  assert.equal(await readDemoVerifiedSession(req("GET", `${STAFF_SESSION_COOKIE}=invalid`), db), null);
  assert.equal((await provider.GET(req("GET", `${providerCookie}; ${providerCookie}`))).status, 200);
  assert.equal((await (await provider.GET(req("GET", `${providerCookie}; ${providerCookie}`))).json()).data.status, "signed_out");
  const adminCookie = await signedIn(admin, "admin", providerCookie);
  assert.equal((await readStaffSession(req("GET", providerCookie), db, now)).status, "signed_out", "登录运营撤销原服务方会话");
  assert.equal(await readDemoVerifiedSession(req("GET", adminCookie), db), null, "运营身份不能变成服务方");
  const ownerResponse = await owner.POST(req("POST", adminCookie, credentials("owner")));
  assert.equal(ownerResponse.status, 200);
  assert.equal((await readStaffSession(req("GET", adminCookie), db, now)).status, "signed_out");
  const nextProvider = await signedIn(provider, "provider", cookie(ownerResponse));
  assert.equal((await (await owner.GET(req("GET", cookie(ownerResponse)))).json()).data.status, "signed_out");
  assert.equal((await provider.DELETE(req("DELETE", nextProvider))).status, 200);
  assert.equal((await readStaffSession(req("GET", nextProvider), db, now)).status, "signed_out");
  const expiring = await signedIn(admin, "admin"); now = new Date(now.getTime() + 31 * 60_000);
  assert.equal((await readStaffSession(req("GET", expiring), db, now)).status, "signed_out");
  const changedRole = await signedIn(admin, "admin");
  await db.user.update({ where: { id: accounts.adminId }, data: { role: "owner" } });
  assert.equal((await readStaffSession(req("GET", changedRole), db, now)).status, "signed_out");
  await db.user.update({ where: { id: accounts.adminId }, data: { role: "admin" } });
  const changedPassword = await signedIn(admin, "admin");
  await db.staffCredential.update({ where: { userId: accounts.adminId }, data: { passwordHash: "changed" } });
  assert.equal((await readStaffSession(req("GET", changedPassword), db, now)).status, "signed_out");
  for (let i = 0; i < 5; i++) assert.equal((await provider.POST(req("POST", "", { login: "unknown-account", password: "Wrong password 0000" }))).status, 401);
  const limited = await provider.POST(req("POST", "", { login: "unknown-account", password: "Wrong password 0000" }));
  assert.equal(limited.status, 429); assert.ok(limited.headers.has("retry-after"));
});
