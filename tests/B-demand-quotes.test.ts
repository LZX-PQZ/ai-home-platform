import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Quote, envelope, type QuoteDTO } from "../src/contracts";
import { ApiClientError } from "../src/lib/api-client";
import { demoDemand, providers, quotes } from "../src/lib/mock-data";
import { loadQuoteComparison, QuoteDemandNotFound, quoteLoadErrorMessage } from "../src/features/b/load-quotes";
import { QuoteComparison } from "../src/features/b/QuoteComparison";
import { QuotePage, QuotePageContent } from "../src/features/b/QuotePage";

const success = (data: unknown, source: "mock" | "live" = "live") => Response.json({ ok: true, data, meta: { source } });
const failure = (status: number, code: string) => Response.json({ ok: false, error: { code, message: "测试错误" } }, { status });

test("报价读取只使用已开放协议，同一需求仅显示已提交/接受的报价并重算小计", async (t) => {
  const id = "saved-demand";
  const candidates: QuoteDTO[] = [
    ...quotes,
    { ...quotes[0], demandId: id, id: "submitted", knownTotalCents: 1 },
    { ...quotes[1], demandId: id, id: "accepted", status: "accepted" },
    { ...quotes[0], demandId: id, id: "draft", status: "draft" },
    { ...quotes[0], demandId: id, id: "rejected", status: "rejected" },
  ];
  const urls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    urls.push(url);
    if (url === "/api/quote") return success(candidates, "mock");
    if (url === "/api/provider") return success(providers, "mock");
    return success({ ...demoDemand, id, source: "live" });
  });
  const data = await loadQuoteComparison(id);
  assert.deepEqual(urls, [`/api/demand/${id}`, "/api/quote", "/api/provider"]);
  assert.deepEqual(data.response.data.map((value) => value.id), ["submitted", "accepted"]);
  assert.deepEqual(data.response.data.map((value) => value.knownTotalCents), [1200000, 1300000]);
  assert.equal(data.response.data[0].items[1].amountCents, null);
  assert.deepEqual(data.response.data[0].pendingItems, ["垃圾清运"]);
  assert.ok(envelope(Quote.array()).safeParse(data.response).success);
});

test("新需求不混入演示报价，空模拟结果不声称真实报价不存在，也不加载服务方", async (t) => {
  const id = "saved-empty";
  const urls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    urls.push(url);
    if (url === "/api/quote") return success(quotes, "mock");
    if (url === "/api/provider") throw new Error("不应该查询服务方");
    return success({ ...demoDemand, id, source: "live" });
  });
  const data = await loadQuoteComparison(id);
  assert.deepEqual(data.response.data, []);
  assert.equal(data.providerSource, null);
  assert.deepEqual(urls, [`/api/demand/${id}`, "/api/quote"]);
  const html = renderToStaticMarkup(createElement(QuoteComparison, { data }));
  for (const text of ["需求来源：已保存的需求数据", "报价来源：模拟报价", "暂无属于这份需求的模拟报价", "不能据此判断是否存在真实报价"]) assert.ok(html.includes(text), text);
  assert.ok(!html.includes("<table "));
  assert.ok(!html.includes("¥12,000.00"));
  assert.ok(html.includes(`href="/owner/matches/${id}"`));
});

test("各数据源独立标识，混合来源不冒充全部 live，空 live 报价仍是正常空结果", async (t) => {
  for (const demandSource of ["mock", "live"] as const) {
    for (const quoteSource of ["mock", "live"] as const) {
      for (const providerSource of ["mock", "live"] as const) {
        t.mock.method(globalThis, "fetch", async (url: string) => url === "/api/quote" ? success(quotes, quoteSource) : url === "/api/provider" ? success(providers, providerSource) : success({ ...demoDemand, source: demandSource }, demandSource));
        const data = await loadQuoteComparison(demoDemand.id);
        assert.equal(data.demandSource, demandSource);
        assert.equal(data.quoteSource, quoteSource);
        assert.equal(data.providerSource, providerSource);
        assert.equal(data.response.meta.source, [demandSource, quoteSource, providerSource].every((source) => source === "live") ? "live" : "mock");
        t.mock.restoreAll();
      }
    }
  }
  t.mock.method(globalThis, "fetch", async (url: string) => url === "/api/quote" ? success([]) : success({ ...demoDemand, source: "live" }));
  const data = await loadQuoteComparison(demoDemand.id);
  assert.equal(data.response.meta.source, "live");
  const html = renderToStaticMarkup(createElement(QuoteComparison, { data }));
  assert.ok(html.includes("暂无可对比的报价"));
  assert.ok(!html.includes("模拟报价"));
});

test("报价页逐条需求来源独立于整体信封，有报价和空报价均不猜测缺失来源", async (t) => {
  for (const demandSource of ["mock", "live", undefined] as const) {
    for (const overallSource of ["mock", "live"] as const) {
      for (const rows of [quotes, []]) {
        t.mock.method(globalThis, "fetch", async (url: string) => url === "/api/quote" ? success(rows)
          : url === "/api/provider" ? success(providers)
            : success({ ...demoDemand, source: demandSource }, overallSource));
        const data = await loadQuoteComparison(demoDemand.id);
        assert.equal(data.demandSource, demandSource);
        assert.equal(data.response.meta.source, demandSource === "live" && overallSource === "live" ? "live" : "mock");
        const html = renderToStaticMarkup(createElement(QuoteComparison, { data }));
        const label = demandSource === "mock" ? "模拟数据" : demandSource === "live" ? "已保存的需求数据" : "未知（接口未提供逐条来源）";
        assert.ok(html.includes(`需求来源：${label}`));
        assert.ok(html.includes("报价来源：报价接口数据"));
        if (demandSource === undefined) {
          assert.ok(html.includes("需求来源未知"));
          assert.ok(!html.includes("需求来源：已保存的需求数据"));
          assert.ok(!html.includes("需求来源：模拟数据"));
          assert.ok(!html.includes("整体响应含模拟数据"));
        }
        t.mock.restoreAll();
      }
    }
  }
});

test("报价读取拒绝非法逐条需求来源，不掩盖为来源未知", async (t) => {
  for (const source of ["unknown", null]) {
    t.mock.method(globalThis, "fetch", async () => success({ ...demoDemand, source }));
    await assert.rejects(loadQuoteComparison(demoDemand.id), (error) => error instanceof ApiClientError && error.code === "INVALID_RESPONSE");
    t.mock.restoreAll();
  }
});

test("特殊 ID 精确编码，空 ID 不请求，响应 ID 错误立即失败", async (t) => {
  const id = "需求/a?b#c%20";
  const urls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    urls.push(url);
    return url === "/api/quote" ? success([]) : success({ ...demoDemand, id });
  });
  assert.equal((await loadQuoteComparison(id)).demand.id, id);
  assert.equal(urls[0], `/api/demand/${encodeURIComponent(id)}`);
  const count = urls.length;
  for (const empty of ["", " "]) await assert.rejects(loadQuoteComparison(empty), (error) => error instanceof ApiClientError && error.code === "VALIDATION_ERROR");
  assert.equal(urls.length, count);
  await assert.rejects(loadQuoteComparison("other"), (error) => error instanceof ApiClientError && error.code === "INVALID_RESPONSE");
});

test("只有详情 404/DEMAND_NOT_FOUND 是需求未找到，报价失败不能伪装为无需求", async (t) => {
  t.mock.method(globalThis, "fetch", async () => failure(404, "DEMAND_NOT_FOUND"));
  await assert.rejects(loadQuoteComparison("unknown"), QuoteDemandNotFound);
  t.mock.restoreAll();
  for (const stage of ["/api/quote"]) {
    t.mock.method(globalThis, "fetch", async (url: string) => url === stage ? failure(404, "DEMAND_NOT_FOUND") : url === "/api/quote" ? success(quotes) : success(demoDemand));
    await assert.rejects(loadQuoteComparison(demoDemand.id), ApiClientError);
    t.mock.restoreAll();
  }
});

test("需求或报价的 501/503/网络/坏 JSON/业务失败均中止，不产生空成功", async (t) => {
  const failures = [
    () => failure(501, "NOT_IMPLEMENTED"),
    () => failure(503, "DATABASE_UNAVAILABLE"),
    () => { throw new TypeError("network"); },
    () => new Response("bad json"),
    () => Response.json({ ok: false, error: { code: "FAILED", message: "失败" } }),
    () => Response.json({ ok: true, data: [], meta: { source: "unknown" } }),
    () => Response.json({ ok: true, data: {} }),
  ];
  for (const stage of [`/api/demand/${demoDemand.id}`, "/api/quote"]) {
    for (const reply of failures) {
      t.mock.method(globalThis, "fetch", async (url: string) => url === stage ? reply() : url === "/api/quote" ? success(quotes) : success(demoDemand));
      await assert.rejects(loadQuoteComparison(demoDemand.id), ApiClientError);
      t.mock.restoreAll();
    }
  }
  assert.match(quoteLoadErrorMessage(new ApiClientError("", "NOT_IMPLEMENTED", 501)), /尚未开放/);
});

test("刷新重新读取需求和报价，删除后的 404 不保留上一份报价数据", async (t) => {
  let deleted = false;
  t.mock.method(globalThis, "fetch", async (url: string) => {
    if (url === "/api/quote") return success(quotes, "mock");
    if (url === "/api/provider") return success(providers, "mock");
    return deleted ? failure(404, "DEMAND_NOT_FOUND") : success(demoDemand);
  });
  assert.equal((await loadQuoteComparison(demoDemand.id)).response.data.length, 2);
  deleted = true;
  await assert.rejects(loadQuoteComparison(demoDemand.id), QuoteDemandNotFound);
});

test("报价初始 HTML 披露模拟来源并禁用重试，失败/未找到不显示旧表格", () => {
  const initial = renderToStaticMarkup(createElement(QuotePage, { demandId: "new-demand" }));
  assert.match(initial, /当前报价接口提供模拟数据/);
  assert.match(initial, /disabled=""/);
  assert.ok(!initial.includes("<table "));
  for (const state of [{ status: "not-found" }, { status: "error", message: "读取失败" }] as const) {
    const html = renderToStaticMarkup(createElement(QuotePageContent, { state, retry: () => undefined }));
    assert.ok(html.includes("重新加载"));
    assert.ok(!html.includes('disabled=""'));
    assert.ok(!html.includes("<table "));
  }
});
