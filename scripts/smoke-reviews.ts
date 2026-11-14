import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { Review, envelope } from "../src/contracts";
import { createOwnerAccount } from "../src/lib/owner-account";

/** Real HTTP and password login; completed states and quotes are explicitly synthetic test fixtures. */
export async function smokeReviews(base: string) {
  assert.ok(process.env.DATABASE_URL?.trim(), "Set DATABASE_URL to a seeded isolated test database");
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname), "Review fixtures require a loopback test server");
  const db = new PrismaClient();
  const owners: string[] = [];
  const password = randomBytes(24).toString("hex");
  const prefix = `review-smoke-${randomBytes(6).toString("hex")}`;
  const providerId = `${prefix}-provider`;
  const http = async (path: string, method = "GET", cookie = "", input?: unknown) => {
    const response = await fetch(base + path, { method, headers: { Origin: new URL(base).origin, Cookie: cookie, "Content-Type": "application/json" },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
    const payload = await response.json(); return { response, payload };
  };
  const denied = async (result: Awaited<ReturnType<typeof http>>, status: number, code: string) => {
    assert.equal(result.response.status, status); assert.equal(result.payload.ok, false); assert.equal(result.payload.error.code, code);
    assert.equal("data" in result.payload, false); assert.equal("meta" in result.payload, false);
    assert.equal(result.response.headers.get("cache-control"), "private, no-store"); assert.match(result.response.headers.get("vary") ?? "", /Cookie/i);
  };
  try {
    for (const suffix of ["one", "two"]) owners.push((await createOwnerAccount({ login: `${prefix}-${suffix}`, name: "Synthetic review smoke", password }, db)).userId);
    await db.serviceProvider.create({ data: { id: providerId, name: "Synthetic review provider", city: "Test", kind: "construction", tagsJson: "[]", rating: 3 } });
    const login = async (suffix: string) => {
      const result = await http("/api/auth/owner", "POST", "", { login: `${prefix}-${suffix}`, password });
      assert.equal(result.response.status, 200); return result.response.headers.get("set-cookie")!.split(";")[0];
    };
    const cookie = await login("one"); const otherCookie = await login("two");
    let lastDemandId = "";
    for (const source of ["mock", "live"] as const) {
      const demand = await http("/api/demand", "POST", cookie, { description: "Synthetic review smoke; no real fulfillment", city: "Test", areaM2: 20,
        budgetMinCents: 0, budgetMaxCents: 10000, renovationType: "repair", desiredDays: 10 });
      assert.equal(demand.response.status, 201); const demandId = demand.payload.data.id as string; lastDemandId = demandId;
      const target = `/api/review?demandId=${encodeURIComponent(demandId)}`;
      const input = { demandId, providerId, rating: 4, comment: " Synthetic review " };
      assert.deepEqual((await http(target, "GET", cookie)).payload, { ok: true, data: [], meta: { source: "live" } });
      await denied(await http("/api/review", "POST", cookie, input), 409, "REVIEW_NOT_ALLOWED");
      // This directly inserted quote is test preparation, not a production provider authentication flow.
      const quote = await db.quote.create({ data: { demandId, providerId, source, status: "submitted", itemsJson: "[]", pendingItemsJson: "[]", knownTotalCents: 0, estimatedDays: 10 } });
      const accepted = await http("/api/order", "POST", cookie, { demandId, quoteId: quote.id, confirmed: true });
      assert.equal(accepted.response.status, 201); assert.equal(accepted.payload.meta.source, source);
      await denied(await http("/api/review", "POST", cookie, input), 409, "REVIEW_NOT_ALLOWED");
      // No completion API exists yet. Only this isolated test prepares a consistent completed pair.
      await db.$transaction([
        db.demandOrder.update({ where: { id: demandId }, data: { status: "completed" } }),
        db.serviceOrder.update({ where: { demandId }, data: { status: "completed" } }),
      ]);
      await denied(await http("/api/review", "POST", otherCookie, input), 404, "DEMAND_NOT_FOUND");
      await denied(await http(target, "GET", otherCookie), 404, "DEMAND_NOT_FOUND");
      await denied(await http("/api/review", "POST", cookie, { ...input, providerId: "missing" }), 409, "REVIEW_PROVIDER_MISMATCH");
      await denied(await http("/api/review", "POST", cookie, { ...input, source: "live" }), 400, "VALIDATION_ERROR");
      const saved = await http("/api/review", "POST", cookie, input); assert.equal(saved.response.status, 201);
      assert.equal(saved.response.headers.get("cache-control"), "private, no-store"); assert.match(saved.response.headers.get("vary") ?? "", /Cookie/i);
      const result = envelope(Review).parse(saved.payload); assert.equal(result.meta.source, source); assert.equal(result.data.source, source);
      assert.equal(result.data.comment, input.comment.trim()); assert.equal(result.data.orderId, accepted.payload.data.id);
      const stored = await db.review.findUniqueOrThrow({ where: { id: result.data.id } }); assert.deepEqual(stored, result.data);
      const replay = await http("/api/review", "POST", cookie, input); assert.equal(replay.response.status, 200); assert.deepEqual(replay.payload, saved.payload);
      const read = await http(target, "GET", cookie); assert.equal(read.response.status, 200);
      assert.deepEqual(read.payload, { ok: true, data: [result.data], meta: { source } });
      await denied(await http("/api/review", "POST", cookie, { ...input, rating: 5 }), 409, "REVIEW_ALREADY_EXISTS");
      assert.equal(await db.review.count({ where: { demandId } }), 1);
      await db.review.update({ where: { id: result.data.id }, data: { source: "broken" } });
      await denied(await http(target, "GET", cookie), 503, "REVIEW_UNAVAILABLE");
      await db.review.update({ where: { id: result.data.id }, data: { source } });
      assert.equal((await db.demandOrder.findUniqueOrThrow({ where: { id: demandId } })).status, "completed");
      assert.equal((await db.serviceOrder.findUniqueOrThrow({ where: { demandId } })).status, "completed");
    }
    assert.equal((await db.serviceProvider.findUniqueOrThrow({ where: { id: providerId } })).rating, 3);
    assert.equal((await http("/api/auth/owner", "DELETE", cookie)).response.status, 200);
    await denied(await http(`/api/review?demandId=${encodeURIComponent(lastDemandId)}`, "GET", cookie), 401, "UNAUTHENTICATED");
    await denied(await http("/api/review", "POST", cookie, { demandId: lastDemandId, providerId, rating: 4, comment: "Synthetic review" }), 401, "UNAUTHENTICATED");
    assert.equal((await http("/api/auth/owner", "DELETE", otherCookie)).response.status, 200);
    console.log("评价生产 HTTP 通过：真实登录、接受报价、未完成拒绝、合成 completed 夹具后的保存/读取/重放、mock/live 保留、跨业主/坏数据/退出拒绝；未实现完工 API。");
  } finally {
    try {
      if (owners.length) {
        const scope = { demand: { ownerId: { in: owners } } };
        await db.review.deleteMany({ where: scope }); await db.serviceOrder.deleteMany({ where: scope });
        await db.quote.deleteMany({ where: scope }); await db.demandOrder.deleteMany({ where: { ownerId: { in: owners } } });
        await db.user.deleteMany({ where: { id: { in: owners } } });
      }
      await db.serviceProvider.deleteMany({ where: { id: providerId } });
    } finally { await db.$disconnect(); }
  }
}
