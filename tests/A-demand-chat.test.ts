import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_FORM,
  MAX_MESSAGES,
  appendMessage,
  describeFailure,
  formFromDraft,
  formToInput,
  interpretDemandSubmit,
  normalizeOutgoing,
  parseChatResponse,
  toChatPayload,
  yuanToCents,
  type ChatMessage,
} from "../src/features/a/demand-chat";

test("空消息与超长消息在本地被拦下，不发给接口", () => {
  assert.equal(normalizeOutgoing("   ").ok, false);
  assert.equal(normalizeOutgoing("x".repeat(4001)).ok, false);
  const ok = normalizeOutgoing("  深圳 60 平老房  ");
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.value, "深圳 60 平老房");
});

test("对话历史裁剪到契约允许的 30 条且保留最新消息", () => {
  let messages: ChatMessage[] = [{ role: "assistant", content: "开场" }];
  for (let index = 0; index < 40; index += 1) {
    messages = appendMessage(messages, { role: "user", content: `第 ${index} 条` });
  }
  assert.equal(messages.length, MAX_MESSAGES);
  assert.equal(messages.at(-1)?.content, "第 39 条");
  assert.equal(toChatPayload(messages).messages.length, MAX_MESSAGES);
});

test("空白消息不会进入请求体", () => {
  const payload = toChatPayload([
    { role: "assistant", content: "开场" },
    { role: "user", content: "   " },
  ]);
  assert.equal(payload.messages.length, 1);
});

test("元转分只接受非负两位小数，且不产生浮点尾数", () => {
  assert.equal(yuanToCents("30000"), 3000000);
  assert.equal(yuanToCents("1.5"), 150);
  assert.equal(yuanToCents("0.07"), 7);
  assert.equal(yuanToCents("19.99"), 1999);
  for (const bad of ["", "-1", "1.234", "abc", "1e3"]) {
    assert.equal(yuanToCents(bad), null, `应拒绝 ${bad}`);
  }
});

test("表单转契约：倒置预算与非法工期被拒，并给出中文字段提示", () => {
  const base = {
    ...EMPTY_FORM,
    description: "深圳 60 平老房适老化改造",
    city: "深圳",
    areaM2: "60",
    budgetMinYuan: "30000",
    budgetMaxYuan: "50000",
    desiredDays: "30",
  };
  const ok = formToInput(base);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.value.budgetMinCents, 3000000);

  const inverted = formToInput({ ...base, budgetMinYuan: "60000" });
  assert.equal(inverted.ok, false);
  if (!inverted.ok) assert.ok(inverted.messages.some((message) => message.includes("预算")));

  const noDays = formToInput({ ...base, desiredDays: "0" });
  assert.equal(noDays.ok, false);
  if (!noDays.ok) assert.ok(noDays.messages.some((message) => message.includes("期望工期")));

  const badArea = formToInput({ ...base, areaM2: "六十" });
  assert.equal(badArea.ok, false);
});

test("草稿映射成表单；无草稿时给空表单，不虚构数值", () => {
  assert.deepEqual(formFromDraft(null), EMPTY_FORM);
  const form = formFromDraft({
    description: "浴室防滑",
    city: "深圳",
    areaM2: 60,
    budgetMinCents: 3000000,
    budgetMaxCents: 5000000,
    renovationType: "elderly",
    desiredDays: 30,
  });
  assert.equal(form.budgetMinYuan, "30000");
  assert.equal(form.budgetMaxYuan, "50000");
  assert.equal(form.areaM2, "60");
});

test("对话响应缺 meta.source 或字段不符时按契约失败处理", () => {
  const data = { reply: "请补充预算", ready: false, draft: null, missingFields: ["budgetMinCents"] };
  assert.throws(() => parseChatResponse({ ok: true, data }));
  assert.throws(() => parseChatResponse({ ok: true, data: { ...data, ready: "no" }, meta: { source: "mock" } }));
  const parsed = parseChatResponse({ ok: true, data, meta: { source: "mock" } });
  assert.equal(parsed.source, "mock");
  assert.deepEqual(parsed.data.missingFields, ["budgetMinCents"]);
});

test("501 判为未开放，不会被当作保存成功", () => {
  const payload = { ok: false, error: { code: "NOT_IMPLEMENTED", message: "这是开工骨架，此操作尚未实现。" } };
  const failure = describeFailure(501, payload);
  assert.equal(failure.notImplemented, true);
  const outcome = interpretDemandSubmit(501, payload);
  assert.equal(outcome.kind, "not_implemented");

  const rejected = interpretDemandSubmit(400, {
    ok: false,
    error: { code: "VALIDATION_ERROR", message: "需求格式不符合契约" },
  });
  assert.equal(rejected.kind, "rejected");

  assert.equal(interpretDemandSubmit(200, { ok: true, data: {} }).kind, "failed");
});

test("成功信封能被解析，并带出需求 ID 与来源", () => {
  const demand = {
    id: "demand-123",
    description: "浴室防滑",
    city: "深圳",
    areaM2: 60,
    budgetMinCents: 3000000,
    budgetMaxCents: 5000000,
    renovationType: "elderly",
    desiredDays: 30,
    status: "draft",
  };
  const outcome = interpretDemandSubmit(200, { ok: true, data: demand, meta: { source: "mock" } });
  assert.equal(outcome.kind, "created");
  if (outcome.kind === "created") {
    assert.equal(outcome.demand.id, "demand-123");
    assert.equal(outcome.source, "mock");
  }
});
