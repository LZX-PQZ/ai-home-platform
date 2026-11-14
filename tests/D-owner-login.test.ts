import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { OwnerLoginInput, OwnerSessionState, envelope } from "../src/contracts";
import { createOwnerAccount } from "../src/lib/owner-account";
import { OWNER_SESSION_COOKIE, readOwnerVerifiedSession } from "../src/lib/owner-auth";
import { createOwnerSessionHandlers } from "../src/lib/owner-session-handlers";
import { hashOwnerPassword, PasswordCapacityError, verifyOwnerPassword } from "../src/lib/owner-password";

const origin = "https://localhost:3000";
const input = { login: "synthetic-owner", password: "Synthetic owner password 42!" };
function request(method = "GET", cookie = "", body?: unknown, site = origin) {
  return new Request(`${site}/api/auth/owner`, { method, headers: { origin: site, cookie, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
function noCache(response: Response) {
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("vary"), "Cookie");
}
async function denied(response: Response, status: number, code: string) {
  noCache(response);
  assert.equal(response.status, status);
  assert.equal(response.headers.get("set-cookie"), null);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.error.code, code);
  assert.doesNotMatch(JSON.stringify(body), /passwordHash|scrypt|private database|Synthetic owner password/);
  return body;
}

test("业主登录输入只接受密码凭证；随机盐、固定 KDF 参数及密码原值", async () => {
  assert.equal(OwnerLoginInput.parse({ ...input, login: " SYNTHETIC-OWNER " }).login, input.login);
  for (const extra of ["userId", "role", "providerId", "source"]) assert.equal(OwnerLoginInput.safeParse({ ...input, [extra]: "forged" }).success, false);
  for (const password of ["short", "a".repeat(129)]) assert.equal(OwnerLoginInput.safeParse({ ...input, password }).success, false);
  const value = ` ${input.password} `;
  const hash = await hashOwnerPassword(value);
  assert.notEqual(await hashOwnerPassword(value), hash);
  assert.equal(await verifyOwnerPassword(value, hash), true);
  assert.equal(await verifyOwnerPassword(value.trim(), hash), false);
  assert.equal(await verifyOwnerPassword(value, null), false);
  await assert.rejects(verifyOwnerPassword(value, "scrypt$1$1$1$invalid"));
  const active = [verifyOwnerPassword(value, hash), verifyOwnerPassword(value, null)];
  await assert.rejects(verifyOwnerPassword(value, hash), PasswordCapacityError);
  assert.deepEqual(await Promise.all(active), [true, false]);
});

test("业主登录：隔离 SQLite 合成账号，实际密码校验/会话/限频，不接触开发数据", async t => {
  const tempRoot = resolve(tmpdir());
  const fixture = mkdtempSync(join(tempRoot, "ai-home-D-owner-login-"));
  const databasePath = join(fixture, "login.db");
  const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  t.after(async () => {
    await db.$disconnect();
    assert.equal(dirname(resolve(fixture)), tempRoot);
    assert.ok(basename(fixture).startsWith("ai-home-D-owner-login-"));
    rmSync(fixture, { recursive: true, force: true });
  });
  writeFileSync(databasePath, "");
  execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "db", "push", "--schema", resolve("prisma/schema.prisma"), "--skip-generate"], {
    env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe", timeout: 30000,
  });
  await db.user.create({ data: { id: "demo-owner", name: "Synthetic existing demo", role: "owner" } });
  const owner = await createOwnerAccount({ ...input, name: "Synthetic owner" }, db);
  const other = await createOwnerAccount({ ...input, login: "owner-two", name: "Synthetic second" }, db);
  const originalCredential = await db.ownerCredential.findUniqueOrThrow({ where: { userId: owner.userId } });
  const initialTime = new Date();
  let now = initialTime;
  const api = createOwnerSessionHandlers(db, () => now);
  const login = async (cookie = "", credentials = input) => {
    const response = await api.POST(request("POST", cookie, credentials));
    assert.equal(response.status, 200);
    noCache(response);
    const body = envelope(OwnerSessionState).parse(await response.json());
    assert.equal(body.meta.source, "live");
    assert.equal(body.data.status, "signed_in");
    return { cookie: response.headers.get("set-cookie")!.split(";")[0], response, body };
  };
  const read = async (cookie = "") => {
    const response = await api.GET(request("GET", cookie));
    assert.equal(response.status, 200);
    noCache(response);
    return envelope(OwnerSessionState).parse(await response.json()).data;
  };
  t.beforeEach(async () => {
    now = initialTime;
    await db.ownerLoginAttempt.deleteMany();
    await db.user.update({ where: { id: owner.userId }, data: { role: "owner" } });
    await db.ownerCredential.update({ where: { userId: owner.userId }, data: { passwordHash: originalCredential.passwordHash } });
  });

  await t.test("开通仅创建新业主，重复账号原子回滚，不覆盖已有演示账号或暴露明文", async () => {
    const before = await db.user.count();
    await assert.rejects(createOwnerAccount({ ...input, login: " SYNTHETIC-OWNER ", name: "duplicate" }, db));
    assert.equal(await db.user.count(), before);
    assert.equal(await db.ownerCredential.count(), 2);
    assert.notEqual(owner.userId, "demo-owner");
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: owner.userId } })).role, "owner");
    assert.equal(await db.ownerCredential.findUnique({ where: { userId: "demo-owner" } }), null);
    assert.doesNotMatch(JSON.stringify(await db.ownerCredential.findMany()), /Synthetic owner password/);
    // CLI cannot accept passwords in argv or via a pipe, and prints no exception fields.
    try {
      execFileSync(process.execPath, [resolve("node_modules/tsx/dist/cli.mjs"), "scripts/create-owner.ts"], {
        input: "not-a-terminal", env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe", timeout: 30000,
      });
      assert.fail("non-interactive provisioning must fail");
    } catch (error) {
      assert.match(String((error as { stderr: unknown }).stderr), /未开通账号/);
      assert.doesNotMatch(String((error as { stderr: unknown }).stderr), /passwordHash|not-a-terminal/);
    }
  });

  await t.test("密码登录签发安全随机 cookie，刷新/重连读同一身份且不续期", async () => {
    assert.deepEqual(await read(), { status: "signed_out" });
    const saved = await login("", { ...input, login: " SYNTHETIC-OWNER " });
    for (const flag of [/HttpOnly/, /Secure/, /SameSite=Strict/, /Path=\//, /Max-Age=1800/]) assert.match(saved.response.headers.get("set-cookie")!, flag);
    assert.match(saved.cookie, new RegExp(`^${OWNER_SESSION_COOKIE}=[a-f0-9]{64}$`));
    assert.doesNotMatch(JSON.stringify(saved.body), /password|token|scrypt/);
    const token = saved.cookie.split("=")[1];
    const stored = await db.ownerSession.findUniqueOrThrow({ where: { tokenHash: createHash("sha256").update(token).digest("hex") } });
    assert.notEqual(stored.tokenHash, token);
    assert.equal(stored.userId, owner.userId);
    await db.$disconnect();
    now = new Date(now.getTime() + 60_000);
    assert.deepEqual(await read(saved.cookie), saved.body.data);
    assert.deepEqual(await db.$transaction(tx => readOwnerVerifiedSession(request("GET", saved.cookie), tx)), { userId: owner.userId, role: "owner", providerId: null });
    now = stored.expiresAt;
    assert.deepEqual(await read(saved.cookie), { status: "signed_out" });
  });

  await t.test("错误/未知账号、角色改变均同一 401，不凭客户端身份或演示 cookie 登录", async () => {
    const before = await db.ownerSession.count();
    const results = [];
    for (const credentials of [{ ...input, password: "Incorrect password 42!" }, { ...input, login: "unknown-owner" }]) {
      const req = request("POST", "ai_home_demo_session=forged", credentials);
      req.headers.set("x-user-id", owner.userId);
      req.headers.set("x-role", "owner");
      results.push(await denied(await api.POST(req), 401, "INVALID_CREDENTIALS"));
    }
    await db.user.update({ where: { id: owner.userId }, data: { role: "admin" } });
    results.push(await denied(await api.POST(request("POST", "", input)), 401, "INVALID_CREDENTIALS"));
    assert.deepEqual(results[0], results[1]);
    assert.deepEqual(results[0], results[2]);
    assert.equal(await db.ownerSession.count(), before);
  });

  await t.test("输入与来源先于存储；有/无 Content-Length 的超大正文均拒绝", async () => {
    const broken = createOwnerSessionHandlers({ $transaction: async () => { throw new Error("private database"); } } as unknown as PrismaClient);
    for (const mutate of [
      (req: Request) => req.headers.delete("origin"),
      (req: Request) => req.headers.set("origin", "https://evil.test"),
      (req: Request) => req.headers.set("origin", "http://localhost:3000"),
      (req: Request) => req.headers.set("origin", "https://localhost:3001"),
      (req: Request) => req.headers.set("sec-fetch-site", "cross-site"),
    ]) {
      for (const method of ["POST", "DELETE"]) {
        const req = request(method, "", method === "POST" ? input : undefined);
        mutate(req);
        req.headers.set("x-forwarded-host", "localhost:3000");
        await denied(await broken[method as "POST" | "DELETE"](req), 403, "FORBIDDEN");
        assert.equal(req.bodyUsed, false);
      }
    }
    for (const method of ["GET", "POST", "DELETE"] as const) {
      const req = request(method, "", method === "POST" ? input : undefined, "http://example.test");
      req.headers.set("x-forwarded-proto", "https");
      await denied(await broken[method](req), 403, "FORBIDDEN");
    }
    for (const body of [null, {}, { ...input, userId: owner.userId }, { ...input, password: "short" }, { ...input, login: "bad/login" }]) {
      await denied(await broken.POST(request("POST", "", body)), 400, "VALIDATION_ERROR");
    }
    for (const raw of ["{", " ".repeat(4097)]) {
      await denied(await broken.POST(new Request(`${origin}/api/auth/owner`, { method: "POST", headers: { origin }, body: raw })), 400, "VALIDATION_ERROR");
    }
    const oversized = request("POST", "", input);
    oversized.headers.set("content-length", "99999");
    await denied(await broken.POST(oversized), 400, "VALIDATION_ERROR");
    assert.equal(oversized.bodyUsed, false);
    assert.equal(await db.ownerLoginAttempt.count(), 0);
    const loopback = new NextRequest("http://127.0.0.1:3188/api/auth/owner", { method: "POST",
      headers: { origin: "http://127.0.0.1:3188", host: "127.0.0.1:3188" }, body: JSON.stringify(input) });
    assert.equal((await api.POST(loopback)).status, 200);
  });

  await t.test("每账号限频含成功和未知账号，重连保留；全局限频及到期恢复", async () => {
    for (let i = 0; i < 5; i++) await login();
    await db.$disconnect();
    const limited = await api.POST(request("POST", "", input));
    assert.equal(limited.headers.get("retry-after"), "900");
    await denied(limited, 429, "RATE_LIMITED");
    // Unknown-account buckets are identical; fixture skips expensive failed guesses already covered above.
    await db.ownerLoginAttempt.create({ data: { key: createHash("sha256").update("unknown-owner").digest("hex"), count: 5, resetsAt: new Date(now.getTime() + 900000) } });
    await denied(await api.POST(request("POST", "", { ...input, login: "unknown-owner" })), 429, "RATE_LIMITED");
    await db.ownerLoginAttempt.update({ where: { key: "global" }, data: { count: 60 } });
    const global = await api.POST(request("POST", "", { ...input, login: "owner-two" }));
    assert.equal(global.headers.get("retry-after"), "300");
    await denied(global, 429, "RATE_LIMITED");
    now = new Date(now.getTime() + 900001);
    await login();
  });

  await t.test("重新登录原子轮换旧会话，换账号不沿用旧身份；退出幂等撤销并清 cookie", async () => {
    const first = await login();
    const second = await login(first.cookie, { ...input, login: other.login });
    assert.notEqual(first.cookie, second.cookie);
    assert.deepEqual(await read(first.cookie), { status: "signed_out" });
    assert.equal(second.body.data.status === "signed_in" && second.body.data.identity.userId, other.userId);
    for (let i = 0; i < 2; i++) {
      const response = await api.DELETE(request("DELETE", second.cookie));
      assert.equal(response.status, 200);
      assert.match(response.headers.get("set-cookie")!, /Max-Age=0/);
      assert.deepEqual(envelope(OwnerSessionState).parse(await response.json()).data, { status: "signed_out" });
    }
    assert.deepEqual(await read(second.cookie), { status: "signed_out" });
    assert.deepEqual(await read(`${first.cookie}; ${first.cookie}`), { status: "signed_out" });
  });

  await t.test("密码验证后凭证/角色变化不能签发；失败不留下新会话", async () => {
    for (const change of [
      () => db.user.update({ where: { id: owner.userId }, data: { role: "provider" } }),
      () => db.ownerCredential.update({ where: { userId: owner.userId }, data: { passwordHash: "changed-digest" } }),
    ]) {
      await db.user.update({ where: { id: owner.userId }, data: { role: "owner" } });
      await db.ownerCredential.update({ where: { userId: owner.userId }, data: { passwordHash: originalCredential.passwordHash } });
      const observed = db.$extends({ query: { ownerCredential: { async findUnique({ args, query }) {
        const found = await query(args);
        if (!args.include) await change();
        return found;
      } } } });
      const before = await db.ownerSession.count();
      await denied(await createOwnerSessionHandlers(observed as unknown as PrismaClient).POST(request("POST", "", input)), 401, "INVALID_CREDENTIALS");
      assert.equal(await db.ownerSession.count(), before);
    }
  });

  await t.test("签发失败回滚旧会话撤销；GET/退出存储故障不伪装成功或泄露异常", async () => {
    const previous = await login();
    const fail = async () => { throw new Error("private database passwordHash"); };
    const broken = createOwnerSessionHandlers(db.$extends({ query: { ownerSession: { create: fail } } }) as unknown as PrismaClient);
    const before = await db.ownerSession.count();
    await denied(await broken.POST(request("POST", previous.cookie, input)), 503, "SESSION_UNAVAILABLE");
    assert.equal(await db.ownerSession.count(), before);
    assert.deepEqual(await read(previous.cookie), previous.body.data);
    const storage = createOwnerSessionHandlers(db.$extends({ query: { ownerSession: { findUnique: fail, updateMany: fail } } }) as unknown as PrismaClient);
    await denied(await storage.GET(request("GET", previous.cookie)), 503, "SESSION_UNAVAILABLE");
    await denied(await storage.DELETE(request("DELETE", previous.cookie)), 503, "SESSION_UNAVAILABLE");
    assert.deepEqual(await read(previous.cookie), previous.body.data);
    await db.user.update({ where: { id: owner.userId }, data: { role: "admin" } });
    assert.deepEqual(await read(previous.cookie), { status: "signed_out" });
  });

  await t.test("默认公开路由用实际密码登录、刷新和退出，无注入成功身份", async () => {
    const script = join(fixture, "public-login.ts");
    const modulePath = (path: string) => JSON.stringify(resolve(path).replaceAll("\\", "/"));
    writeFileSync(script, `
      import assert from 'node:assert/strict';
      import { GET, POST, DELETE } from ${modulePath("src/app/api/auth/owner/route.ts")};
      import { prisma } from ${modulePath("src/lib/prisma.ts")};
      async function main() {
        const req = (method, cookie = '', body) => new Request('${origin}/api/auth/owner', { method,
          headers: { origin: '${origin}', cookie }, ...(body ? { body: JSON.stringify(body) } : {}) });
        const login = await POST(req('POST', '', ${JSON.stringify(input)}));
        assert.equal(login.status, 200);
        const cookie = login.headers.get('set-cookie').split(';')[0];
        assert.equal((await (await GET(req('GET', cookie))).json()).data.status, 'signed_in');
        assert.equal((await DELETE(req('DELETE', cookie))).status, 200);
        assert.equal((await (await GET(req('GET', cookie))).json()).data.status, 'signed_out');
        console.log('public-login-ok');
      }
      main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
    `);
    const output = execFileSync(process.execPath, [resolve("node_modules/tsx/dist/cli.mjs"), script], {
      env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: "utf8", stdio: "pipe", timeout: 30000,
    });
    assert.match(output, /public-login-ok/);
  });
});
