import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Quote, type QuoteDTO } from "../src/contracts";
import { ProviderOrdersContent } from "../src/features/c/ProviderOrders";
import {
  loadProviderOrders, providerOrdersErrorMessage, summarizeProviderOrders, type ProviderOrdersState,
} from "../src/features/c/provider-orders";

const quote = Quote.parse({
  id: "C-quote-order", demandId: "C-order-demand", providerId: "C-provider", status: "submitted",
  items: [{ code: "repair", name: "维修", unit: "job", quantity: 1, unitPriceCents: 10000, amountCents: 10000, note: "" }],
  knownTotalCents: 10000, pendingItems: [], estimatedDays: 5,
});

function payload(data: QuoteDTO[] = [quote], source: "mock" | "live" = "mock") {
  return { ok: true as const, data, meta: { source } };
}

function render(state: ProviderOrdersState) {
  return renderToStaticMarkup(createElement(ProviderOrdersContent, { state, onReload() {} }));
}

test("接单页只调用公共报价 GET，保留来源并统计已确认与待确认状态", async (t) => {
  const data = [quote, { ...quote, id: "C-accepted", status: "accepted" as const }];
  const fetchMock = t.mock.method(globalThis, "fetch", async (path: string, init?: RequestInit) => {
    assert.equal(path, "/api/quote");
    assert.equal(init?.method, undefined);
    return Response.json(payload(data, "live"));
  });
  const response = await loadProviderOrders();
  assert.deepEqual(response.data, data);
  assert.deepEqual(summarizeProviderOrders(data), { accepted: 1, submitted: 1 });
  const html = render({ status: "ready", response });
  for (const text of ["报价列表来源：实时接口（live）", "已确认承接", "待业主确认", "报价服务方编号", "查看关联需求", "不能据此认定为你的真实接单"]) {
    assert.ok(html.includes(text), text);
  }
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("空列表保留来源并说明不代表没有历史接单", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json(payload([], "mock")));
  const response = await loadProviderOrders();
  const html = render({ status: "ready", response });
  for (const text of ["本次接口暂无报价记录", "报价列表来源：模拟标识（mock）", "不代表平台没有历史接单或报价"]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /<li[^>]*>.*C-quote-order/);
  assert.deepEqual(summarizeProviderOrders(response.data), { accepted: 0, submitted: 0 });
});

test("加载中与失败不显示旧记录，错误可重试且不泄露内部信息", () => {
  const loading = render({ status: "loading" });
  assert.match(loading, /正在读取接单记录/);
  assert.doesNotMatch(loading, /C-quote-order|报价列表来源：/);
  for (const status of [401, 403, 501, 503]) {
    const html = render({ status: "error", message: providerOrdersErrorMessage({ status, code: "FAILURE" }) });
    assert.match(html, /暂时无法加载接单记录/);
    assert.match(html, /重新加载/);
    assert.doesNotMatch(html, /内部敏感/);
  }
});

test("拒绝缺失来源、重复报价和 HTTP 501 伪成功", async (t) => {
  for (const body of [
    { ok: true, data: [quote] },
    payload([quote, quote]),
  ]) {
    const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json(body));
    await assert.rejects(loadProviderOrders());
    fetchMock.mock.restore();
  }
  const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json(payload([quote]), { status: 501 }));
  await assert.rejects(loadProviderOrders(), (error: unknown) => {
    assert.match(providerOrdersErrorMessage(error), /尚未实现/);
    return true;
  });
  fetchMock.mock.restore();
});

test("接单记录编码关联需求编号，不提供写入或履约确认动作", () => {
  const html = render({ status: "ready", response: payload([{ ...quote, demandId: "需求/a?b#c" }]) });
  assert.match(html, /href="\/provider\/demand\/%E9%9C%80%E6%B1%82%2Fa%3Fb%23c"/);
  assert.doesNotMatch(html, /接单成功|确认接单|开始施工|<form/);
});
