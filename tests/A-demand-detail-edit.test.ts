import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Demand } from "../src/contracts";
import { DemandEditPanel } from "../src/features/a/DemandEditPanel";
import {
  demandCanMutate,
  demandFormFromDetail,
  deleteDemand,
  updateDemand,
} from "../src/features/a/demand-detail-edit";

const demand = Demand.parse({
  id: "d-1",
  description: "卫生间防滑改造",
  city: "深圳",
  areaM2: 70,
  budgetMinCents: 3500000,
  budgetMaxCents: 5200000,
  renovationType: "elderly",
  desiredDays: 35,
  status: "published",
  source: "live",
});

const form = demandFormFromDetail(demand);
const ok = (data: unknown, source = "live") => ({ ok: true, data, meta: { source } });

const previousReact = Object.getOwnPropertyDescriptor(globalThis, "React");
before(() => Object.defineProperty(globalThis, "React", { configurable: true, value: React }));
after(() => {
  if (previousReact) Object.defineProperty(globalThis, "React", previousReact);
  else Reflect.deleteProperty(globalThis, "React");
});

test("详情编辑只允许未签约真实需求，表单映射复用公共字段", () => {
  assert.equal(demandCanMutate(demand), true);
  assert.equal(demandFormFromDetail(demand).budgetMinYuan, "35000");
  assert.equal(demandFormFromDetail(demand).budgetMaxYuan, "52000");
  assert.equal(demandCanMutate({ ...demand, id: "demo-demand" }), false);
  assert.equal(demandCanMutate({ ...demand, status: "contracted" }), false);
});

test("详情编辑卡片按状态提供操作，演示需求保持只读", () => {
  const liveHtml = renderToStaticMarkup(createElement(DemandEditPanel, { demand, onChanged() {} }));
  assert.match(liveHtml, /编辑需求/);
  assert.match(liveHtml, /删除需求/);

  const demoHtml = renderToStaticMarkup(createElement(DemandEditPanel, {
    demand: { ...demand, id: "demo-demand", source: "mock" },
    onChanged() {},
  }));
  assert.match(demoHtml, /演示需求，不能修改或删除/);
  assert.doesNotMatch(demoHtml, /编辑需求/);
  assert.doesNotMatch(demoHtml, /删除需求/);
});

test("更新发送完整 DemandInput，校验成功响应的 ID 和逐条来源", async (t) => {
  const request = t.mock.method(globalThis, "fetch", async (path: string, init?: RequestInit) => {
    assert.equal(path, "/api/demand/d-1");
    assert.equal(init?.method, "PUT");
    assert.equal(init?.headers && new Headers(init.headers).get("content-type"), "application/json");
    assert.deepEqual(JSON.parse(String(init?.body)), {
      description: "卫生间防滑改造",
      city: "深圳",
      areaM2: 70,
      budgetMinCents: 3500000,
      budgetMaxCents: 5200000,
      renovationType: "elderly",
      desiredDays: 35,
    });
    return Response.json(ok(demand, "live"));
  });
  assert.deepEqual(await updateDemand("d-1", form), { kind: "updated", demand, source: "live" });
  assert.equal(request.mock.callCount(), 1);
});

test("非法编辑表单不发请求；响应错位或缺来源不产生成功态", async (t) => {
  const request = t.mock.method(globalThis, "fetch", async () => Response.json(ok({ ...demand, id: "other" })));
  const invalid = await updateDemand("d-1", { ...form, budgetMinYuan: "52001", budgetMaxYuan: "52000" });
  assert.equal(invalid.kind, "rejected");
  assert.equal(request.mock.callCount(), 0);

  const mismatch = await updateDemand("d-1", form);
  assert.equal(mismatch.kind, "failed");
  assert.equal(request.mock.callCount(), 1);
  t.mock.restoreAll();

  const missingSource = t.mock.method(globalThis, "fetch", async () => Response.json({ ok: true, data: demand }));
  const failed = await updateDemand("d-1", form);
  assert.equal(failed.kind, "failed");
  assert.equal(missingSource.mock.callCount(), 1);
});

test("更新和删除的 501 均明确失败，不能把伪造成功信封当成成功", async (t) => {
  for (const [action, response] of [
    ["update", Response.json(ok(demand), { status: 501 })],
    ["delete", Response.json(ok({ id: "d-1", deleted: true }), { status: 501 })],
  ] as const) {
    const request = t.mock.method(globalThis, "fetch", async () => response);
    const result = action === "update" ? await updateDemand("d-1", form) : await deleteDemand("d-1");
    assert.equal(result.kind, "failed");
    if (result.kind === "failed") assert.match(result.message, /尚未开放/);
    assert.equal(request.mock.callCount(), 1);
    t.mock.restoreAll();
  }
});

test("删除校验返回的 ID、deleted 和来源，并保留业务错误", async (t) => {
  const request = t.mock.method(globalThis, "fetch", async (path: string, init?: RequestInit) => {
    assert.equal(path, "/api/demand/d-1");
    assert.equal(init?.method, "DELETE");
    return Response.json(ok({ id: "d-1", deleted: true }, "live"));
  });
  assert.deepEqual(await deleteDemand("d-1"), { kind: "deleted", result: { id: "d-1", deleted: true }, source: "live" });
  assert.equal(request.mock.callCount(), 1);
  t.mock.restoreAll();

  const conflict = t.mock.method(globalThis, "fetch", async () => Response.json(
    { ok: false, error: { code: "DEMAND_HAS_RELATED_RECORDS", message: "存在关联记录" } },
    { status: 409 },
  ));
  const result = await deleteDemand("d-1");
  assert.equal(result.kind, "failed");
  if (result.kind === "failed") assert.match(result.message, /不允许修改/);
  assert.equal(conflict.mock.callCount(), 1);
});
