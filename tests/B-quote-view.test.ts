import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuoteTable } from "../src/components/QuoteTable";
import { QuoteComparison } from "../src/features/b/QuoteComparison";
import { formatQuoteMoney } from "../src/features/b/format-quote";
import { loadQuoteData } from "../src/lib/quote-engine/data";
import { providers, quotes } from "../src/lib/mock-data";

test("报价金额展示区分未知与零，并保留安全整数范围内的分位", () => {
  assert.equal(formatQuoteMoney(null), "待确认");
  assert.equal(formatQuoteMoney(0), "¥0.00");
  assert.equal(formatQuoteMoney(101), "¥1.01");
  assert.equal(formatQuoteMoney(Number.MAX_SAFE_INTEGER), "¥90,071,992,547,409.91");
});

test("报价页展示来源、供应方、列明费用及服务范围限制", () => {
  const data = loadQuoteData();
  assert.ok(data);
  const html = renderToStaticMarkup(createElement(QuoteComparison, { data }));
  for (const text of ["模拟数据 · 非真实市场报价", providers[0].name, "¥12,000.00", "¥13,000.00", "垃圾清运", "待确认", "不代表最终总价更低", "实际范围需现场确认"]) {
    assert.ok(html.includes(text), text);
  }
  assert.equal((html.match(/<table /g) ?? []).length, 2);
  assert.ok(html.includes('href="/owner/matches/demo-demand"'));
  assert.ok(html.includes('href="/owner/demand/demo-demand"'));
});

test("报价组件重算缓存合计并保留未知项目，不显示虚构总额", () => {
  const html = renderToStaticMarkup(createElement(QuoteTable, { quotes: [{ ...quotes[0], knownTotalCents: 99999900, pendingItems: [] }] }));
  assert.ok(html.includes("¥12,000.00"));
  assert.ok(!html.includes("¥999,999.00"));
  assert.ok(html.includes("待确认项目"));
  assert.ok(html.includes("名称待确认"));
});

test("暂无报价与缺少明细给出各自提示，不把空报价描述为完整定价", () => {
  const empty = renderToStaticMarkup(createElement(QuoteTable, { quotes: [] }));
  assert.ok(empty.includes("暂无可对比的报价"));
  assert.ok(!empty.includes("¥0.00"));
  const noItems = renderToStaticMarkup(createElement(QuoteTable, { quotes: [{ ...quotes[0], items: [], pendingItems: [] }] }));
  assert.ok(noItems.includes("尚未提供报价明细"));
  assert.ok(noItems.includes("没有明细不代表免费"));
  assert.ok(!noItems.includes("当前明细金额均已列明"));
});
