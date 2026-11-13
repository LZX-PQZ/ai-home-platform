import test from "node:test";
import assert from "node:assert/strict";
import type { DemandDTO } from "../src/contracts";
import {
  demandTitle,
  findDemand,
  formatBudget,
  formatYuan,
  statusLabel,
  statusTone,
} from "../src/features/a/demand-list";

const base: DemandDTO = {
  id: "d-1",
  description: "60 平老房适老化改造",
  city: "深圳",
  areaM2: 60,
  budgetMinCents: 3000000,
  budgetMaxCents: 5000000,
  renovationType: "elderly",
  desiredDays: 30,
  status: "published",
};

test("五种状态都有中文文案与色调，不会把英文枚举直接显示给业主", () => {
  const statuses: DemandDTO["status"][] = [
    "draft",
    "published",
    "contracted",
    "in_progress",
    "completed",
  ];
  for (const status of statuses) {
    const label = statusLabel(status);
    assert.equal(typeof label, "string");
    assert.ok(label.length > 0);
    assert.notEqual(label, status, `状态 ${status} 未翻译`);
    assert.ok(["brand", "accent", "neutral", "danger"].includes(statusTone(status)));
  }
});

test("金额按分换算成元并保留千分位，负数与非法值不产生怪数字", () => {
  assert.equal(formatYuan(3000000), "¥30,000");
  assert.equal(formatYuan(0), "¥0");
  assert.equal(formatYuan(-100), "¥0");
  assert.equal(formatYuan(Number.NaN), "¥0");
  assert.equal(formatYuan(1234567), "¥12,346");
});

test("预算区间上下限相同时只显示一个金额", () => {
  assert.equal(formatBudget(3000000, 3000000), "¥30,000");
  assert.equal(formatBudget(3000000, 5000000), "¥30,000 – ¥50,000");
});

test("列表标题由城市、面积、改造类型拼成，不出现空标题", () => {
  const title = demandTitle(base);
  assert.ok(title.includes("深圳"));
  assert.ok(title.includes("60"));
  assert.ok(title.includes("适老"));
});

test("按 ID 查找：命中返回该条，不命中返回 null（供页面如实提示）", () => {
  const list = [base, { ...base, id: "d-2", city: "广州" }];
  assert.equal(findDemand(list, "d-2")?.city, "广州");
  assert.equal(findDemand(list, "d-404"), null);
  assert.equal(findDemand([], "d-1"), null);
});
