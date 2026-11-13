import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Demand, type DemandDTO } from "../src/contracts";
import { DemandDetailContent } from "../src/features/c/DemandDetail";
import { DemandHallContent } from "../src/features/c/DemandHall";
import {
  demandDetailErrorMessage,
  loadDemandDetail,
  type DemandDetailState,
} from "../src/features/c/demand-detail";

// 测试专用模拟记录；运行中的页面只读取公共接口。
const demand = Demand.parse({
  id: "C-detail-test",
  description: "测试模拟需求：厨房改造\n保留原有橱柜。",
  city: "深圳",
  areaM2: 25.5,
  budgetMinCents: 0,
  budgetMaxCents: 3000050,
  renovationType: "partial",
  desiredDays: 15,
  status: "published",
});

function render(state: DemandDetailState, demandId = demand.id) {
  return renderToStaticMarkup(createElement(DemandDetailContent, { demandId, state, onReload() {} }));
}

test("需求详情只调用已有列表接口并按 ID 精确查找，不选择首条或默认演示需求", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async (path: string) => {
    assert.equal(path, "/api/demand");
    return Response.json({
      ok: true,
      data: [{ ...demand, id: "demo-demand", city: "北京" }, demand],
      meta: { source: "mock" },
    });
  });
  const response = await loadDemandDetail(demand.id);
  assert.deepEqual(response.data, demand);
  assert.equal(response.meta.source, "mock");
  assert.equal(fetchMock.mock.callCount(), 1);
  for (const id of ["missing-demand", "C-detail", "c-detail-test", ` ${demand.id}`]) {
    assert.equal((await loadDemandDetail(id)).data, null);
  }
});

test("未发布状态不可从详情页展示，未找到不等同于后台资源不存在", async (t) => {
  const statuses: DemandDTO["status"][] = ["draft", "contracted", "in_progress", "completed"];
  t.mock.method(globalThis, "fetch", async () => Response.json({
    ok: true,
    data: statuses.map((status) => ({ ...demand, id: status, status })),
    meta: { source: "mock" },
  }));
  for (const status of statuses) {
    const response = await loadDemandDetail(status);
    assert.equal(response.data, null);
    const html = render({ status: "ready", response }, status);
    assert.match(html, /当前列表中未找到该已发布需求/);
    assert.match(html, /返回需求大厅/);
    assert.match(html, /刷新详情/);
    assert.match(html, /数据来源：模拟数据（mock）/);
    assert.doesNotMatch(html, /<article|测试模拟需求|<form/);
  }
});

test("详情空列表保留 live 来源，不生成兜底记录", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ ok: true, data: [], meta: { source: "live" } }));
  const response = await loadDemandDetail(demand.id);
  assert.equal(response.data, null);
  const html = render({ status: "ready", response });
  assert.match(html, /数据来源：实时接口（live）/);
  assert.match(html, /未包含在当前列表中/);
  assert.doesNotMatch(html, /数据来源：模拟数据|<article/);
});

test("详情展示全部公共字段，按分转元，说明模拟来源及未实现功能", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ ok: true, data: [demand], meta: { source: "mock" } }));
  const html = render({ status: "ready", response: await loadDemandDetail(demand.id) });
  for (const text of [
    demand.id, demand.description, demand.city, "局部改造", "25.5 平方米", "0.00", "30,000.50", "15 天", "已发布",
    "数据来源：模拟数据（mock）", "不代表真实客户需求", "角色导航不代表登录鉴权",
    "详情从当前需求列表中读取", "报价提交和接单功能待接入", "填写报价 · 本地预览",
  ]) assert.ok(html.includes(text), text);
  assert.match(html, /href="\/provider"/);
  assert.doesNotMatch(html, /已接单|报价成功/);
  assert.match(html, /本地预览不代表保存或提交/);
});

test("live 详情不冒充模拟来源，空描述有占位且文本被安全转义", async (t) => {
  for (const description of ["", "<script>alert('test')</script>"]) {
    const mocked = t.mock.method(globalThis, "fetch", async () => Response.json({
      ok: true, data: [{ ...demand, description }], meta: { source: "live" },
    }));
    const html = render({ status: "ready", response: await loadDemandDetail(demand.id) });
    assert.match(html, /数据来源：实时接口（live）/);
    assert.doesNotMatch(html, /数据来源：模拟数据|<script/);
    assert.match(html, description ? /&lt;script&gt;/ : /业主暂未填写需求描述/);
    mocked.mock.restore();
  }
});

test("大厅详情链接编码 ID，详情读取不再次解码或截断 ID", async (t) => {
  const id = "测试/a?b#c%2F";
  const response = { ok: true as const, data: [{ ...demand, id }], meta: { source: "mock" as const } };
  const html = renderToStaticMarkup(createElement(DemandHallContent, { state: { status: "ready", response }, onReload() {} }));
  assert.ok(html.includes(`href="/provider/demand/${encodeURIComponent(id)}"`));
  assert.match(html, /查看需求详情/);
  assert.doesNotMatch(html, /需求详情、报价提交和接单功能待接入/);
  t.mock.method(globalThis, "fetch", async () => Response.json(response));
  assert.equal((await loadDemandDetail(id)).data?.id, id);
  assert.equal((await loadDemandDetail(decodeURIComponent(id))).data, null);
});

test("详情拒绝无效公共字段、缺失来源及 HTTP 200 的业务失败", async (t) => {
  const payloads = [
    { ok: true, data: [demand] },
    { ok: true, data: [demand], meta: { source: "unknown" } },
    { ok: true, data: [{ ...demand, budgetMaxCents: -1 }], meta: { source: "mock" } },
    { ok: false, error: { code: "NOT_IMPLEMENTED", message: "未实现" } },
  ];
  for (const payload of payloads) {
    const mocked = t.mock.method(globalThis, "fetch", async () => Response.json(payload));
    await assert.rejects(loadDemandDetail(demand.id));
    mocked.mock.restore();
  }
});

test("HTTP 501 明确为未实现错误，可重试且不显示成功或未找到", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ ok: false, error: { code: "NOT_IMPLEMENTED", message: "未实现" } }, { status: 501 }));
  await assert.rejects(loadDemandDetail(demand.id), (error: unknown) => {
    const html = render({ status: "error", message: demandDetailErrorMessage(error) });
    assert.match(html, /尚未实现/);
    assert.match(html, /role="alert"/);
    assert.match(html, /重新加载/);
    assert.doesNotMatch(html, /<article|数据来源：|未找到|<form/);
    return true;
  });
});

test("HTTP 404/500、网络失败和非 JSON 响应不能当成空详情", async (t) => {
  const failures = [
    async () => Response.json({ ok: false }, { status: 404 }),
    async () => Response.json({ ok: true, data: [demand], meta: { source: "mock" } }, { status: 500 }),
    async () => { throw new TypeError("Failed to fetch"); },
    async () => new Response("not json"),
  ];
  for (const failure of failures) {
    const mocked = t.mock.method(globalThis, "fetch", failure);
    await assert.rejects(loadDemandDetail(demand.id), (error: unknown) => {
      const html = render({ status: "error", message: demandDetailErrorMessage(error) });
      assert.match(html, /需求详情加载失败/);
      assert.doesNotMatch(html, /<article|未找到|数据来源：|<form/);
      return true;
    });
    mocked.mock.restore();
  }
});

test("详情加载中禁用刷新，首次 HTML 已说明演示性质；空 ID 不发送请求", async (t) => {
  const html = render({ status: "loading" });
  assert.match(html, /disabled=""/);
  assert.match(html, /role="status"/);
  assert.match(html, /正在读取需求详情/);
  assert.match(html, /模拟数据仅用于演示/);
  assert.doesNotMatch(html, /<article|数据来源：|未找到|<form/);
  const mocked = t.mock.method(globalThis, "fetch", async () => { throw new Error("不应发送请求"); });
  await assert.rejects(loadDemandDetail(""));
  assert.equal(mocked.mock.callCount(), 0);
});
