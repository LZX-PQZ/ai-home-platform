import * as React from "react";
import type { DemandDTO, ProviderDTO, QuoteDTO } from "@/contracts";
import { formatQuoteMoney } from "@/features/b/format-quote";
import { QuoteBudgetSummary } from "@/features/b/QuoteBudgetSummary";
import { QuoteDurationSummary } from "@/features/b/QuoteDurationSummary";
import { getPendingQuoteItems, summarizeQuote } from "@/lib/quote-engine";

const units: Record<QuoteDTO["items"][number]["unit"], string> = { m2: "㎡", piece: "件", job: "项" };
const statuses: Record<QuoteDTO["status"], string> = {
  draft: "草稿", submitted: "已提交", accepted: "已接受", rejected: "已拒绝",
};

export function QuoteTable({ quotes, providers = [], demand }: { quotes: QuoteDTO[]; providers?: ProviderDTO[]; demand?: DemandDTO }) {
  if (!quotes.length) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><h2>暂无可对比的报价</h2><p className="mb-0 text-slate-600">这份需求还没有已提交或已接受的报价，请等待服务方补充。</p></div>;
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      {quotes.map((quote) => {
        const summary = summarizeQuote(quote);
        const pending = getPendingQuoteItems(quote);
        const providerName = providers.find((provider) => provider.id === quote.providerId)?.name ?? `服务方 ${quote.providerId}（名称待确认）`;
        return (
          <article className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" key={quote.id}>
            <header className="border-b border-slate-100 p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-500">报价编号：{quote.id}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{statuses[quote.status]}</span>
              </div>
              <h3 className="text-lg font-semibold">{providerName}</h3>
              <p className="mb-0 mt-2 text-sm text-slate-600">预计施工 {quote.estimatedDays} 天 · 档期待确认</p>
            </header>

            <div className="overflow-x-auto" role="region" aria-label={`${providerName}报价明细`} tabIndex={0}>
              <table className="w-full min-w-[360px] text-left text-sm">
                <caption className="sr-only">{providerName}的逐项报价，金额单位为人民币元</caption>
                <thead className="bg-slate-50 text-xs text-slate-600"><tr>
                  <th className="px-4 py-3" scope="col">项目 / 范围说明</th>
                  <th className="whitespace-nowrap px-2 py-3" scope="col">数量</th>
                  <th className="whitespace-nowrap px-2 py-3 text-right" scope="col">单价</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right" scope="col">列明金额</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {quote.items.map((item, index) => <tr key={`${item.code}-${index}`}>
                    <th className="break-words px-4 py-4 align-top font-normal" scope="row"><span className="font-medium">{item.name}</span><span className="mt-1 block break-all text-xs text-slate-500">项目编号：{item.code}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{item.note || "服务范围待确认"}</span></th>
                    <td className="whitespace-nowrap px-2 py-4 align-top">{item.quantity} {units[item.unit]}</td>
                    <td className="whitespace-nowrap px-2 py-4 text-right align-top tabular-nums">{formatQuoteMoney(item.unitPriceCents)}</td>
                    <td className={`whitespace-nowrap px-4 py-4 text-right align-top tabular-nums ${item.amountCents === null ? "font-semibold text-amber-800" : ""}`}>{formatQuoteMoney(item.amountCents)}</td>
                  </tr>)}
                  {!quote.items.length && <tr><td className="px-4 py-6 text-slate-600" colSpan={4}>尚未提供报价明细，无法确认费用。</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="space-y-4 border-t border-slate-200 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">已知费用小计</span>
                <strong className="text-2xl tabular-nums text-teal-800">{formatQuoteMoney(summary.knownTotalCents)}</strong>
              </div>
              {demand && <QuoteBudgetSummary demand={demand} quote={quote} />}
              {demand && <QuoteDurationSummary demand={demand} quote={quote} />}
              {summary.pendingItems.length ? <div className="rounded-xl bg-amber-50 p-4 text-amber-950">
                <h4 className="text-sm font-semibold">待确认项目 · {summary.pendingItems.length} 项</h4>
                <ul className="mt-2 list-inside list-disc break-words text-sm leading-6">
                  {pending.extraNames.map((name) => <li key={`extra:${name}`}>{name}</li>)}
                  {pending.items.map((item) => <li key={`item:${item.code}`}>{item.name}<span className="break-all">（项目编号：{item.code}）</span></li>)}
                </ul>
                <p className="mb-0 mt-2 text-xs">未知金额未计入小计；已列明金额的项目仍可能需要确认单价。小计不是最终总价。</p>
              </div> : <p className="mb-0 text-sm text-slate-600">{quote.items.length ? "当前明细金额均已列明，服务范围仍需双方确认。" : "没有明细不代表免费，也不能据此判断最终总价。"}</p>}
            </div>
          </article>
        );
      })}
    </div>
  );
}
