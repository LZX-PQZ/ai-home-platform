import assert from "node:assert/strict";
import test from "node:test";
import {
  detailFallbackReason,
  detailMissingHint,
  detailViaLabel,
  interpretDetailResponse,
} from "../src/features/a/demand-detail";

const demand = {
  id: "d-1",
  description: "70 平老房卫生间防滑改造",
  city: "深圳",
  areaM2: 70,
  budgetMinCents: 3500000,
  budgetMaxCents: 5200000,
  renovationType: "elderly" as const,
  desiredDays: 35,
  status: "published" as const,
};

const ok = (data: unknown, source: "mock" | "live" = "live") => ({ ok: true, data, meta: { source } });

test("按 ID 接口返回合法需求时命中 byId，并带上来源", () => {
  const probe = interpretDetailResponse(200, ok(demand), "d-1");
  assert.equal(probe.kind, "demand");
  if (probe.kind !== "demand") return;
  assert.deepEqual(probe.demand, demand);
  assert.equal(probe.source, "live");
});

test("接口未实现（404/501）时返回回退原因，而不是当成失败", () => {
  const notFound = interpretDetailResponse(404, null, "d-1");
  assert.equal(notFound.kind, "fallback");
  const notImplemented = interpretDetailResponse(501, null, "d-1");
  assert.equal(notImplemented.kind, "fallback");
  if (notImplemented.kind === "fallback") {
    assert.match(notImplemented.reason, /501/);
    assert.match(notImplemented.reason, /回退到列表查找/);
  }
});

test("服务端错误同样回退，原因里带状态码", () => {
  const probe = interpretDetailResponse(503, { ok: false, error: { code: "x", message: "y" } }, "d-1");
  assert.equal(probe.kind, "fallback");
  if (probe.kind === "fallback") assert.match(probe.reason, /503/);
});

test("返回的是另一条需求时拒绝采用，避免张冠李戴", () => {
  const probe = interpretDetailResponse(200, ok({ ...demand, id: "d-2" }), "d-1");
  assert.equal(probe.kind, "fallback");
  if (probe.kind === "fallback") assert.match(probe.reason, /另一条需求/);
});

test("返回数据结构不符合契约时回退，不把半个对象渲染到页面", () => {
  const probe = interpretDetailResponse(200, ok({ id: "d-1", city: "深圳" }), "d-1");
  assert.equal(probe.kind, "fallback");
  if (probe.kind === "fallback") assert.match(probe.reason, /不符合契约/);
});

test("ok:false 的错误信封不会被当成需求", () => {
  const probe = interpretDetailResponse(200, { ok: false, error: { code: "E", message: "坏了" } }, "d-1");
  assert.equal(probe.kind, "fallback");
});

test("回退原因与路径标签都有中文可读文案", () => {
  assert.match(detailFallbackReason(404), /尚未开放/);
  assert.match(detailFallbackReason(403), /没有权限/);
  assert.match(detailFallbackReason(418), /HTTP 418/);
  assert.equal(detailViaLabel("byId"), "按 ID 查询");
  assert.equal(detailViaLabel("list"), "列表回退");
});

test("找不到需求时区分「接口没开」和「确实没有这条」", () => {
  const withReason = detailMissingHint("d-9", "按 ID 查询接口尚未开放（HTTP 501），已回退到列表查找");
  assert.match(withReason, /501/);
  assert.match(withReason, /列表里也没有/);
  assert.match(withReason, /不会用其他样例数据冒充/);

  const withoutReason = detailMissingHint("d-9", null);
  assert.match(withoutReason, /接口未返回编号为「d-9」的需求/);
  assert.doesNotMatch(withoutReason, /列表里也没有/);
});
