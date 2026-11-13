import test from "node:test";
import assert from "node:assert/strict";
import { ZodError } from "zod";
import { QuoteItem, QuoteSubmissionInput } from "../src/contracts";
import { calculateQuoteSubmission } from "../src/lib/quote-engine/submission";
import { POST } from "../src/app/api/quote/route";

const item = { code: "line-1", name: "防滑施工", unit: "m2", quantity: 12.5, unitPriceCents: 8000, note: "含人工" };
const input = { demandId: "saved-demand", estimatedDays: 10, items: [item] };
const post = (value: unknown) => POST(new Request("http://localhost/api/quote", { method: "POST", body: JSON.stringify(value) }));

test("公共输入生成计价字段，金额来自服务端计算，不产生身份、提交状态或成功信封", () => {
  const before = structuredClone(input);
  const result = calculateQuoteSubmission(input);
  assert.equal(result.knownTotalCents, 100000);
  assert.equal(result.items[0].amountCents, 100000);
  assert.equal(result.demandId, input.demandId);
  assert.equal(result.estimatedDays, input.estimatedDays);
  assert.deepEqual(result.pendingItems, []);
  assert.ok(QuoteItem.array().safeParse(result.items).success);
  assert.deepEqual(Object.keys(result).sort(), ["demandId", "estimatedDays", "items", "knownTotalCents", "pendingItems"]);
  assert.deepEqual(input, before);
});

test("按冻结规则逐行四舍五入后求和，不先合并半分费用", () => {
  const result = calculateQuoteSubmission({ ...input, items: [
    { ...item, code: "a", quantity: 0.5, unitPriceCents: 1 },
    { ...item, code: "b", quantity: 0.5, unitPriceCents: 1 },
    { ...item, code: "c", quantity: 1.234, unitPriceCents: 100 },
  ] });
  assert.deepEqual(result.items.map((row) => row.amountCents), [1, 1, 123]);
  assert.equal(result.knownTotalCents, 125);
});

test("零元与未知费用分别保留，同名不同编号的未知项目不合并", () => {
  const result = calculateQuoteSubmission({ ...input, items: [
    { ...item, code: "free", unitPriceCents: 0 },
    { ...item, code: "pending-a", unitPriceCents: null },
    { ...item, code: "pending-b", unitPriceCents: null },
  ] });
  assert.deepEqual(result.items.map((row) => row.amountCents), [0, null, null]);
  assert.deepEqual(result.pendingItems, [item.name, item.name]);
  assert.equal(result.knownTotalCents, 0);
  assert.deepEqual(result.items.map((row) => row.code), ["free", "pending-a", "pending-b"]);
});

test("公共契约的字段规范化用于计价结果，原始输入不被修改", () => {
  const value = { ...input, items: [{ ...item, code: " line-1 ", name: " 防滑施工 ", note: " 含人工 " }] };
  const before = structuredClone(value);
  const result = calculateQuoteSubmission(value);
  assert.equal(result.items[0].code, "line-1");
  assert.equal(result.items[0].name, item.name);
  assert.equal(result.items[0].note, item.note);
  assert.deepEqual(value, before);
});

test("允许安全整数边界，拒绝单行与累计溢出，包括单价有效但乘积溢出", () => {
  const maxItem = { ...item, quantity: 1, unitPriceCents: Number.MAX_SAFE_INTEGER };
  assert.equal(calculateQuoteSubmission({ ...input, items: [maxItem] }).knownTotalCents, Number.MAX_SAFE_INTEGER);
  for (const items of [
    [{ ...maxItem, quantity: 2 }],
    [maxItem, { ...item, code: "extra", quantity: 1, unitPriceCents: 1 }],
  ]) {
    const value = { ...input, items };
    assert.ok(QuoteSubmissionInput.safeParse(value).success, "输入字段合法仍须检查计算溢出");
    assert.throws(() => calculateQuoteSubmission(value), ZodError);
  }
});

test("客户端不能传入身份、行金额、合计、待确认项或状态，非法字段通过 HTTP 被拒绝", async () => {
  const forged = [
    ...Object.entries({ id: "quote-x", providerId: "provider-a", knownTotalCents: 1, pendingItems: [], status: "submitted", amountCents: 1 })
      .map(([key, value]) => ({ ...input, [key]: value })),
    { ...input, items: [{ ...item, amountCents: 1 }] },
    { ...input, items: [{ ...item, providerId: "provider-a" }] },
  ];
  for (const value of forged) {
    const response = await post(value);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { ok: false, error: { code: "VALIDATION_ERROR", message: "报价字段不符合契约，或计算金额超出安全范围。" } });
  }
});

test("输入边界均由公共契约拦截，包括重复编号、非法数量与工期", async () => {
  const invalid = [
    null, [], {}, { ...input, demandId: " " }, { ...input, estimatedDays: 0 },
    { ...input, items: [] }, { ...input, items: [item, { ...item, code: " line-1 " }] },
    { ...input, items: Array.from({ length: 21 }, (_, i) => ({ ...item, code: String(i) })) },
    ...[0, -1, 0.0001, 1000001, NaN, Infinity].map((quantity) => ({ ...input, items: [{ ...item, quantity }] })),
    ...[-1, 1.5, Number.MAX_SAFE_INTEGER + 1, "100"].map((unitPriceCents) => ({ ...input, items: [{ ...item, unitPriceCents }] })),
  ];
  for (const value of invalid) {
    assert.throws(() => calculateQuoteSubmission(value), ZodError);
    const response = await post(value);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).ok, false);
  }
});

test("坏 JSON 返回 400，合法报价与全部未知费用仍返回 501，计算结果不冒充已提交", async () => {
  const badJson = await POST(new Request("http://localhost/api/quote", { method: "POST", body: "{" }));
  assert.equal(badJson.status, 400);
  assert.equal((await badJson.json()).error.code, "INVALID_JSON");
  for (const value of [input, { ...input, items: [{ ...item, unitPriceCents: null }] }]) {
    const response = await post(value);
    assert.equal(response.status, 501);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal(body.error.code, "NOT_IMPLEMENTED");
    assert.equal("data" in body, false);
    assert.equal("meta" in body, false);
  }
  for (const items of [
    [{ ...item, quantity: 2, unitPriceCents: Number.MAX_SAFE_INTEGER }],
    [{ ...item, quantity: 1, unitPriceCents: Number.MAX_SAFE_INTEGER }, { ...item, code: "b", quantity: 1, unitPriceCents: 1 }],
  ]) {
    const response = await post({ ...input, items });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
  }
});
