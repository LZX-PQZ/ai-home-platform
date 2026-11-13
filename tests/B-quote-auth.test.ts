import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/quote/route";
import { handleQuoteSubmission } from "../src/lib/quote-engine/submit-request";
import { prisma } from "../src/lib/prisma";
import { demoDemand } from "../src/lib/mock-data";

const input = { demandId: "saved-demand", estimatedDays: 10, items: [
  { code: "line", name: "测试施工", unit: "job", quantity: 0.145, unitPriceCents: 100, note: "合成测试" },
] };
const request = (value: unknown = input) => new Request("http://localhost/api/quote", { method: "POST", body: JSON.stringify(value) });
const providerSession = async () => ({ userId: "test-user", role: "provider", providerId: "test-provider" });

function isolateDatabase(t: TestContext, read: (args: { where: { id: string } }) => Promise<unknown>) {
  const originalRead = prisma.demandOrder.findUnique;
  const originalCreate = prisma.quote.create;
  const lookup = t.mock.fn(read);
  const create = t.mock.fn(async () => { throw new Error("不应该写入报价"); });
  prisma.demandOrder.findUnique = lookup as unknown as typeof originalRead;
  prisma.quote.create = create as unknown as typeof originalCreate;
  t.after(() => {
    prisma.demandOrder.findUnique = originalRead;
    prisma.quote.create = originalCreate;
    assert.equal(create.mock.callCount(), 0);
  });
  return lookup;
}

async function expectFailure(response: Response, status: number, code: string) {
  assert.equal(response.status, status);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.error.code, code);
  assert.equal("data" in body, false);
  assert.equal("meta" in body, false);
  return body;
}

test("真实 POST 默认 401，认证先于解析和查询，客户端身份提示不会产生登录", async (t) => {
  const lookup = isolateDatabase(t, async () => { throw new Error("未认证不能查需求"); });
  const req = new Request("http://localhost/api/quote?providerId=provider-a", {
    method: "POST", headers: { "x-provider-id": "provider-a", "x-role": "provider", cookie: "role=provider; providerId=provider-a" }, body: "{",
  });
  await expectFailure(await POST(req), 401, "UNAUTHENTICATED");
  assert.equal(req.bodyUsed, false);
  await expectFailure(await POST(request({ ...input, providerId: "provider-a" })), 401, "UNAUTHENTICATED");
  assert.equal(lookup.mock.callCount(), 0);
});

test("D 认证失败原样返回 401/403，不读取请求体或查询需求", async (t) => {
  const lookup = isolateDatabase(t, async () => null);
  for (const [session, status, code] of [
    [null, 401, "UNAUTHENTICATED"],
    [{ userId: "u", role: "owner", providerId: null }, 403, "FORBIDDEN"],
    [{ userId: "u", role: "admin", providerId: null }, 403, "FORBIDDEN"],
    [{ userId: "u", role: "provider", providerId: null }, 403, "FORBIDDEN"],
  ] as const) {
    const req = request();
    await expectFailure(await handleQuoteSubmission(req, async () => session), status, code);
    assert.equal(req.bodyUsed, false);
  }
  await expectFailure(await handleQuoteSubmission(request(), async () => { throw new Error("session detail"); }), 401, "UNAUTHENTICATED");
  assert.equal(lookup.mock.callCount(), 0);
});

test("认证后伪造服务端字段和非法计价返回 400，在需求查询前拒绝", async (t) => {
  const lookup = isolateDatabase(t, async () => null);
  for (const value of [
    { ...input, providerId: "other-provider" },
    { ...input, knownTotalCents: 1 },
    { ...input, items: [] },
    { ...input, items: [{ ...input.items[0], quantity: 2, unitPriceCents: Number.MAX_SAFE_INTEGER }] },
  ]) await expectFailure(await handleQuoteSubmission(request(value), providerSession), 400, "VALIDATION_ERROR");
  assert.equal(lookup.mock.callCount(), 0);
});

test("通过 D 的 findDemand 精确查询当前需求，未知 ID 返回 404，无默认需求回退", async (t) => {
  const lookup = isolateDatabase(t, async () => null);
  const id = "需求/a?b#c%20";
  await expectFailure(await handleQuoteSubmission(request({ ...input, demandId: id }), providerSession), 404, "DEMAND_NOT_FOUND");
  assert.equal(lookup.mock.callCount(), 1);
  assert.deepEqual(lookup.mock.calls[0].arguments[0], { where: { id } });
});

test("仅 published 通过需求状态检查，其余状态为 409；通过后仍为 501", async (t) => {
  let state = "draft";
  isolateDatabase(t, async () => ({ ...demoDemand, id: input.demandId, status: state }));
  for (const status of ["draft", "contracted", "in_progress", "completed", "published"]) {
    state = status;
    await expectFailure(await handleQuoteSubmission(request(), providerSession), status === "published" ? 501 : 409,
      status === "published" ? "NOT_IMPLEMENTED" : "INVALID_STATE");
  }
});

test("数据库异常、契约错误或需求 ID 错位返回 503，不泄露底层错误", async (t) => {
  let read: () => Promise<unknown>;
  isolateDatabase(t, () => read());
  for (const reply of [
    async () => { throw new Error("internal connection secret"); },
    async () => ({ ...demoDemand, id: input.demandId, status: "unknown" }),
    async () => demoDemand,
  ]) {
    read = reply;
    const body = await expectFailure(await handleQuoteSubmission(request(), providerSession), 503, "DATABASE_UNAVAILABLE");
    assert.equal(body.error.message, "需求数据暂时无法读取，请稍后重试。");
  }
});

test("每次提交重新查询，需求状态变化和删除不会继续使用旧结果，演示需求也不写入", async (t) => {
  let row: unknown = { ...demoDemand, id: input.demandId };
  isolateDatabase(t, async () => row);
  await expectFailure(await handleQuoteSubmission(request(), providerSession), 501, "NOT_IMPLEMENTED");
  row = { ...demoDemand, id: input.demandId, status: "contracted" };
  await expectFailure(await handleQuoteSubmission(request(), providerSession), 409, "INVALID_STATE");
  row = null;
  await expectFailure(await handleQuoteSubmission(request(), providerSession), 404, "DEMAND_NOT_FOUND");
  row = demoDemand;
  await expectFailure(await handleQuoteSubmission(request({ ...input, demandId: demoDemand.id }), providerSession), 501, "NOT_IMPLEMENTED");
});
