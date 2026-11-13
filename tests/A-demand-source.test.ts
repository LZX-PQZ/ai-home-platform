import assert from "node:assert/strict";
import test from "node:test";
import {
  DemandWithSource,
  itemSource,
  itemSourceBadge,
  listSourceNote,
} from "../src/features/a/demand-source";

const base = {
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

test("条目带 source 字段时按它逐条标注，互不影响", () => {
  assert.equal(itemSource({ ...base, source: "mock" }), "mock");
  assert.equal(itemSource({ ...base, source: "live" }), "live");
  assert.equal(itemSource(base), null);
});

test("simulated: true 视为模拟；false/缺失不算", () => {
  assert.equal(itemSource({ ...base, simulated: true }), "mock");
  assert.equal(itemSource({ ...base, simulated: false }), null);
});

test("扩展 schema 不会丢弃逐条来源字段（z.object 默认剥掉未知键，必须显式声明）", () => {
  const parsed = DemandWithSource.parse({ ...base, source: "mock" });
  assert.equal(parsed.source, "mock");
});

test("徽标只在确认为模拟时出现，真实数据不加噪音", () => {
  assert.equal(itemSourceBadge({ ...base, source: "mock" }), "模拟数据");
  assert.equal(itemSourceBadge({ ...base, source: "live" }), null);
  assert.equal(itemSourceBadge(base), null);
});

test("列表说明不再断言「只返回演示需求」，按整批来源如实描述", () => {
  const mock = listSourceNote("mock");
  assert.match(mock, /模拟数据/);
  assert.match(mock, /标记为 mock/);
  assert.match(mock, /不代表每条都是模拟数据/);
  assert.match(mock, /尚未提供逐条来源/);
  assert.doesNotMatch(mock, /只返回演示需求/);

  const live = listSourceNote("live");
  assert.match(live, /真实数据库/);

  assert.match(listSourceNote(null), /来源未知/);
});
