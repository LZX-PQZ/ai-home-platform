import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { ZodError } from "zod";
import { ProviderIdentity, Quote, QuoteSubmissionInput } from "../src/contracts";
import { createQuoteAtomically, QuoteWriteRejected, type QuoteTransactionSessionReader } from "../src/lib/quote-engine/transaction";
import { POST } from "../src/app/api/quote/route";

const identity = ProviderIdentity.parse({ userId: "test-provider-user", role: "provider", providerId: "test-provider" });
const input = QuoteSubmissionInput.parse({ demandId: "test-demand", estimatedDays: 5, items: [
  { code: "a", name: "合成明细", unit: "job", quantity: 0.145, unitPriceCents: 100, note: "" },
  { code: "b", name: "合成明细", unit: "job", quantity: 0.145, unitPriceCents: 100, note: "" },
  { code: "c", name: "未知费用", unit: "piece", quantity: 1, unitPriceCents: null, note: "" },
  { code: "d", name: "零元明细", unit: "piece", quantity: 1, unitPriceCents: 0, note: "" },
] });
const request = () => new Request("http://localhost/api/quote", { method: "POST", body: JSON.stringify(input) });
const rejected = (status: number, code: string) => (error: unknown) => error instanceof QuoteWriteRejected && error.status === status && error.code === code;

test("原子报价内核使用隔离 SQLite 验证事务，不连接开发数据库", async (t) => {
  const tempRoot = resolve(tmpdir());
  const fixtureDir = mkdtempSync(join(tempRoot, "ai-home-B-quote-tx-"));
  const databasePath = join(fixtureDir, "quote-test.db");
  const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  t.after(async () => {
    await db.$disconnect();
    const target = resolve(fixtureDir);
    assert.equal(dirname(target), tempRoot);
    assert.ok(basename(target).startsWith("ai-home-B-quote-tx-"));
    rmSync(target, { recursive: true, force: true });
  });
  writeFileSync(databasePath, "");
  // 使用现有 schema 建专用临时数据库，不改 schema、.env 或用户的开发数据库。
  execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "db", "push", "--schema", resolve("prisma/schema.prisma"), "--skip-generate"], {
    env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: ["ignore", "pipe", "pipe"], timeout: 30000,
  });
  await db.user.createMany({ data: [
    { id: "test-owner", name: "Synthetic owner", role: "owner" },
    { id: identity.userId, name: "Synthetic provider user", role: "provider" },
  ] });
  const provider = { id: identity.providerId, name: "Synthetic provider", city: "Test", kind: "construction", tagsJson: "[]", rating: 0 };
  await db.serviceProvider.create({ data: provider });
  const demand = { id: input.demandId, ownerId: "test-owner", description: "Synthetic demand", city: "Test", areaM2: 10,
    budgetMinCents: 100, budgetMaxCents: 1000, renovationType: "repair", desiredDays: 5, status: "published" };
  await db.demandOrder.createMany({ data: [demand, { ...demand, id: "demo-demand" }] });

  // 合成会话仅供测试。特意使用传入 tx 读取角色，不能把此适配器当作真实登录。
  const readSession: QuoteTransactionSessionReader = async (_request, tx) => {
    const currentUser = await tx.user.findUnique({ where: { id: identity.userId } });
    return currentUser ? { ...identity, role: currentUser.role } : null;
  };
  const create = (value: unknown = input, reader = readSession) => createQuoteAtomically(request(), value, identity, reader, db);
  const noQuotes = async () => assert.equal(await db.quote.count(), 0);

  await t.test("事务提交后返回公共 Quote，持久化逐行整数计价、null、零元和服务端身份", async () => {
    const result = Quote.parse(await create());
    assert.equal(result.status, "submitted");
    assert.equal(result.demandId, input.demandId);
    assert.equal(result.providerId, identity.providerId);
    assert.equal(result.knownTotalCents, 30);
    assert.deepEqual(result.items.map((item) => item.amountCents), [15, 15, null, 0]);
    assert.deepEqual(result.pendingItems, ["未知费用"]);
    const row = await db.quote.findUniqueOrThrow({ where: { id: result.id } });
    assert.deepEqual(JSON.parse(row.itemsJson), result.items);
    assert.deepEqual(JSON.parse(row.pendingItemsJson), result.pendingItems);
    assert.equal(row.knownTotalCents, 30);
    assert.equal(await db.quote.count(), 1);
    await db.quote.deleteMany();
  });

  await t.test("即使预检曾通过，事务内会话丢失或异常也不写入", async () => {
    for (const reader of [async () => null, async () => { throw new Error("synthetic session expired"); }]) {
      await assert.rejects(create(input, reader), rejected(401, "UNAUTHENTICATED"));
      await noQuotes();
    }
  });

  await t.test("事务内身份必须仍是同一用户和服务方，换人、换绑、非服务方均拒绝", async () => {
    for (const current of [
      { ...identity, userId: "another-user" }, { ...identity, providerId: "another-provider" },
      { ...identity, role: "owner" }, { ...identity, providerId: null },
    ]) {
      await assert.rejects(create(input, async () => current), rejected(403, "FORBIDDEN"));
      await noQuotes();
    }
  });

  await t.test("事务数据库中的账户角色和服务方存在性不能用旧会话替代", async () => {
    await db.user.update({ where: { id: identity.userId }, data: { role: "owner" } });
    await assert.rejects(create(input, async () => identity), rejected(403, "FORBIDDEN"));
    await noQuotes();
    await db.user.update({ where: { id: identity.userId }, data: { role: "provider" } });
    await db.serviceProvider.delete({ where: { id: identity.providerId } });
    await assert.rejects(create(), rejected(403, "FORBIDDEN"));
    await noQuotes();
    await db.serviceProvider.create({ data: provider });
  });

  await t.test("需求预检之后状态变化，事务内重读并拒绝所有非 published 状态", async () => {
    const preflight = await db.demandOrder.findUniqueOrThrow({ where: { id: input.demandId } });
    assert.equal(preflight.status, "published");
    for (const status of ["draft", "contracted", "in_progress", "completed"]) {
      await db.demandOrder.update({ where: { id: input.demandId }, data: { status } });
      await assert.rejects(create(), rejected(409, "INVALID_STATE"));
      await noQuotes();
    }
    await db.demandOrder.update({ where: { id: input.demandId }, data: { status: "published" } });
  });

  await t.test("需求预检后删除返回 404；演示需求拒绝真实写入", async () => {
    assert.ok(await db.demandOrder.findUnique({ where: { id: input.demandId } }));
    await db.demandOrder.delete({ where: { id: input.demandId } });
    await assert.rejects(create(), rejected(404, "DEMAND_NOT_FOUND"));
    await noQuotes();
    await db.demandOrder.create({ data: demand });
    await assert.rejects(create({ ...input, demandId: "demo-demand" }), rejected(409, "DEMO_DEMAND_READ_ONLY"));
    await noQuotes();
  });

  await t.test("需求复核与身份适配器共用同一个事务，事务内状态变化可见且拒绝后一起回滚", async () => {
    await assert.rejects(create(input, async (req, tx) => {
      await tx.demandOrder.update({ where: { id: input.demandId }, data: { status: "contracted" } });
      return readSession(req, tx);
    }), rejected(409, "INVALID_STATE"));
    await noQuotes();
    assert.equal((await db.demandOrder.findUniqueOrThrow({ where: { id: input.demandId } })).status, "published");
  });

  await t.test("特殊字符 ID 通过事务查询精确保存，不回退到演示需求", async () => {
    const id = "测试/a?b#c%20";
    await db.demandOrder.create({ data: { ...demand, id } });
    const result = await create({ ...input, demandId: id });
    assert.equal(result.demandId, id);
    assert.equal((await db.quote.findUniqueOrThrow({ where: { id: result.id } })).demandId, id);
    await db.quote.deleteMany();
  });

  await t.test("真实插入后若回执不符合契约，整个事务回滚且不返回成功", async () => {
    let inserted = false;
    const faultyDb = db.$extends({ query: { quote: { async create({ args, query }) {
      const row = await query(args);
      inserted = true;
      return { ...row, status: "invalid-output" };
    } } } });
    // Prisma 扩展会改变客户端泛型；这里只注入故障回执，事务仍由同一个真实 SQLite 客户端执行。
    await assert.rejects(createQuoteAtomically(request(), input, identity, readSession, faultyDb as unknown as Pick<PrismaClient, "$transaction">), ZodError);
    assert.equal(inserted, true);
    await noQuotes();
  });

  await t.test("数据库拒绝写入时事务失败，不把失败伪装成成功或自动重复写入", async () => {
    await db.$executeRawUnsafe('CREATE TRIGGER "reject_test_quote" BEFORE INSERT ON "Quote" BEGIN SELECT RAISE(ABORT, \'synthetic write rejection\'); END;');
    try {
      await assert.rejects(create());
      await noQuotes();
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER "reject_test_quote";');
    }
  });

  await t.test("客户端伪造字段和金额溢出由公共契约拒绝，输入不被修改", async () => {
    const before = structuredClone(input);
    for (const value of [
      { ...input, providerId: "forged" }, { ...input, knownTotalCents: 0 },
      { ...input, items: [{ ...input.items[0], quantity: 2, unitPriceCents: Number.MAX_SAFE_INTEGER }] },
    ]) {
      await assert.rejects(create(value), ZodError);
      await noQuotes();
    }
    assert.deepEqual(input, before);
  });

  await t.test("校验时复制输入，异步认证期间改动原对象不会改变已计算的报价", async () => {
    const mutableInput = structuredClone(input);
    const mutableIdentity = structuredClone(identity);
    const result = await createQuoteAtomically(request(), mutableInput, mutableIdentity, async (req, tx) => {
      mutableInput.demandId = "changed-after-validation";
      mutableInput.items[0].unitPriceCents = 999;
      mutableIdentity.providerId = "changed-after-validation";
      return readSession(req, tx);
    }, db);
    assert.equal(result.demandId, input.demandId);
    assert.equal(result.providerId, identity.providerId);
    assert.equal(result.knownTotalCents, 30);
    await db.quote.deleteMany();
  });

  await t.test("公开 POST 不接入原子内核，客户端仍不能获得模拟登录或提交成功", async () => {
    const response = await POST(request());
    assert.equal(response.status, 401);
    assert.equal((await response.json()).ok, false);
    await noQuotes();
  });
});
