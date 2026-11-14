import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { DEMO_PROVIDER_ID, OrderProgressResult, Review, envelope } from "../src/contracts";
import { createOwnerAccount } from "../src/lib/owner-account";

/** Real HTTP login, fulfillment and reviews; only the live-source quote is a synthetic storage fixture. */
export async function smokeReviews(base: string) {
  assert.ok(process.env.DATABASE_URL?.trim(), "Set DATABASE_URL to a seeded isolated test database");
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname), "Review fixtures require a loopback test server");
  const db = new PrismaClient();
  const owners: string[] = [];
  const password = randomBytes(24).toString("hex");
  const prefix = `review-smoke-${randomBytes(6).toString("hex")}`;
  const syntheticProviderId = `${prefix}-provider`;
  let providerCookie = "";
  const http = async (path: string, method = "GET", cookie = "", input?: unknown, headers: Record<string, string> = {}) => {
    const response = await fetch(base + path, { method, headers: { Origin: new URL(base).origin, Cookie: cookie, "Content-Type": "application/json", ...headers },
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
    await db.serviceProvider.create({ data: { id: syntheticProviderId, name: "Synthetic review provider", city: "Test", kind: "construction", tagsJson: "[]", rating: 3 } });
    const providerLogin = await http("/api/auth/demo-provider", "POST", "", { action: "login_demo" });
    assert.equal(providerLogin.response.status, 200, "Enable demo authentication for both isolated smoke processes");
    assert.equal(providerLogin.payload.data.status, "signed_in");
    providerCookie = providerLogin.response.headers.get("set-cookie")!.split(";")[0];
    const login = async (suffix: string) => {
      const result = await http("/api/auth/owner", "POST", "", { login: `${prefix}-${suffix}`, password });
      assert.equal(result.response.status, 200); return result.response.headers.get("set-cookie")!.split(";")[0];
    };
    const cookie = await login("one"); const otherCookie = await login("two");
    let lastDemandId = "";
    for (const source of ["mock", "live"] as const) {
      const providerId = source === "mock" ? DEMO_PROVIDER_ID : syntheticProviderId;
      const demand = await http("/api/demand", "POST", cookie, { description: "Synthetic review smoke; no real fulfillment", city: "Test", areaM2: 20,
        budgetMinCents: 0, budgetMaxCents: 10000, renovationType: "repair", desiredDays: 10 });
      assert.equal(demand.response.status, 201); const demandId = demand.payload.data.id as string; lastDemandId = demandId;
      const target = `/api/review?demandId=${encodeURIComponent(demandId)}`;
      const input = { demandId, providerId, rating: 4, comment: " Synthetic review " };
      assert.deepEqual((await http(target, "GET", cookie)).payload, { ok: true, data: [], meta: { source: "live" } });
      await denied(await http("/api/review", "POST", cookie, input), 409, "REVIEW_NOT_ALLOWED");
      let quoteId: string;
      if (source === "mock") {
        const submitted = await http("/api/quote", "POST", providerCookie, { demandId, estimatedDays: 10,
          items: [{ code: "fixture", name: "合成报价", unit: "job", quantity: 1, unitPriceCents: 100, note: "冒烟测试" }] },
          { "Idempotency-Key": `${prefix}-quote` });
        assert.equal(submitted.response.status, 201); assert.equal(submitted.payload.meta.source, "mock"); quoteId = submitted.payload.data.id;
      } else {
        // There is no live-provider authenticator yet; only this live-source quote is prepared directly.
        quoteId = (await db.quote.create({ data: { demandId, providerId, source, status: "submitted", itemsJson: "[]", pendingItemsJson: "[]", knownTotalCents: 0, estimatedDays: 10 } })).id;
      }
      const accepted = await http("/api/order", "POST", cookie, { demandId, quoteId, confirmed: true });
      assert.equal(accepted.response.status, 201); assert.equal(accepted.payload.meta.source, source);
      await denied(await http("/api/review", "POST", cookie, input), 409, "REVIEW_NOT_ALLOWED");
      let scheduleVersion: number | null = null;
      if (source === "mock") {
        const created = await http("/api/schedule", "POST", cookie, { demandId, tasks: [
          { id: "first", name: "合成第一工序", startDay: 0, durationDays: 1, dependsOn: [] },
          { id: "second", name: "合成后续工序", startDay: 1, durationDays: 1, dependsOn: ["first"] },
        ] });
        assert.equal(created.response.status, 201); scheduleVersion = created.payload.data.version;
      }
      const advance = (action: string, credential = cookie, extra: Record<string, unknown> = {}) => http("/api/order/progress", "POST", credential,
        { demandId, orderId: accepted.payload.data.id, action, confirmed: true, scheduleVersion, ...extra });
      await denied(await advance("start", otherCookie), 404, "DEMAND_NOT_FOUND");
      await denied(await advance("start", providerCookie), 401, "UNAUTHENTICATED");
      await denied(await advance("complete"), 409, "ORDER_PROGRESS_NOT_ALLOWED");
      const started = await advance("start"); assert.equal(started.response.status, 200);
      assert.equal(envelope(OrderProgressResult).parse(started.payload).data.order.status, "in_progress");
      assert.equal((await http(`/api/demand/${demandId}`, "GET", cookie)).payload.data.status, "in_progress");
      if (source === "mock") {
        const verifyProvider = async (status: string) => {
          const list = await http("/api/provider/orders", "GET", providerCookie); assert.equal(list.response.status, 200);
          assert.equal(list.payload.data.find((order: { id: string }) => order.id === accepted.payload.data.id)?.status, status);
          const detail = await http(`/api/demand/${demandId}`, "GET", providerCookie); assert.equal(detail.response.status, 200); assert.equal(detail.payload.data.status, status);
        };
        await verifyProvider("in_progress");
        await denied(await advance("complete"), 409, "SCHEDULE_NOT_COMPLETE");
        await denied(await advance("start_task", cookie, { taskId: "second" }), 409, "TASK_PROGRESS_NOT_ALLOWED");
        for (const taskId of ["first", "second"]) for (const action of ["start_task", "complete_task"]) {
          const priorVersion = scheduleVersion;
          const moved = await advance(action, cookie, { taskId }); assert.equal(moved.response.status, 200);
          const result = envelope(OrderProgressResult).parse(moved.payload); assert.equal(result.meta.source, "mock");
          scheduleVersion = result.data.schedule!.version;
          await denied(await advance(action, cookie, { taskId, scheduleVersion: priorVersion }), 409, "SCHEDULE_VERSION_CONFLICT");
        }
        const history = await http(`/api/schedule?demandId=${demandId}&version=1`, "GET", cookie);
        assert.equal(history.response.status, 200); assert.ok(history.payload.data.tasks.every((task: { status: string }) => task.status === "pending"));
        const completed = await advance("complete"); assert.equal(completed.response.status, 200); await verifyProvider("completed");
      } else {
        assert.equal((await advance("complete")).response.status, 200);
      }
      const completedAgain = await advance("complete"); assert.equal(completedAgain.response.status, 200);
      const progressed = envelope(OrderProgressResult).parse(completedAgain.payload); assert.equal(progressed.data.order.status, "completed"); assert.equal(progressed.meta.source, source);
      await denied(await advance("start"), 409, "ORDER_PROGRESS_NOT_ALLOWED");
      assert.equal(await db.orderProgressEvent.count({ where: { orderId: accepted.payload.data.id } }), source === "mock" ? 6 : 2);
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
    assert.equal((await db.serviceProvider.findUniqueOrThrow({ where: { id: syntheticProviderId } })).rating, 3);
    assert.equal((await http("/api/auth/owner", "DELETE", cookie)).response.status, 200);
    await denied(await http(`/api/review?demandId=${encodeURIComponent(lastDemandId)}`, "GET", cookie), 401, "UNAUTHENTICATED");
    await denied(await http("/api/review", "POST", cookie, { demandId: lastDemandId, providerId: syntheticProviderId, rating: 4, comment: "Synthetic review" }), 401, "UNAUTHENTICATED");
    await denied(await http("/api/order/progress", "POST", cookie), 401, "UNAUTHENTICATED");
    assert.equal((await http("/api/auth/owner", "DELETE", otherCookie)).response.status, 200);
    console.log("履约→评价生产 HTTP 通过：实际登录/演示报价/接受/开工/依赖工序推进/完工/评价，需求与接单始终一致，历史排期保留；无直接改库伪造完工。mock/live、越权/旧版/跳级/退出拒绝通过。");
  } finally {
    try {
      if (providerCookie) await http("/api/auth/demo-provider", "DELETE", providerCookie);
      if (owners.length) {
        const scope = { demand: { ownerId: { in: owners } } };
        await db.orderProgressEvent.deleteMany({ where: { order: scope } });
        await db.review.deleteMany({ where: scope }); await db.serviceOrder.deleteMany({ where: scope });
        await db.schedule.deleteMany({ where: scope });
        await db.quoteSubmissionReceipt.deleteMany({ where: { quote: scope } });
        await db.quote.deleteMany({ where: scope }); await db.demandOrder.deleteMany({ where: { ownerId: { in: owners } } });
        await db.user.deleteMany({ where: { id: { in: owners } } });
      }
      await db.serviceProvider.deleteMany({ where: { id: syntheticProviderId } });
    } finally { await db.$disconnect(); }
  }
}
