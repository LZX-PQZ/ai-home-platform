import * as React from "react";
import Link from "next/link";
import { QuoteTable } from "@/components/QuoteTable";
import { formatQuoteMoney } from "@/features/b/format-quote";
import type { loadQuoteData } from "@/lib/quote-engine/data";

export function QuoteComparison({ data }: { data: NonNullable<ReturnType<typeof loadQuoteData>> }) {
  const { demand, providers, response } = data;
  const id = encodeURIComponent(demand.id);
  return (
    <div className="space-y-7">
      <header>
        <Link className="text-sm" href={`/owner/matches/${id}`}>← 返回服务方匹配</Link>
        <div className="mb-3 mt-6 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800">透明报价</span>
          <span className="badge">{response.meta.source === "mock" ? "模拟数据 · 非真实市场报价" : "报价数据"}</span>
        </div>
        <h1>先看清每一项，再比较报价</h1>
        <p className="max-w-2xl text-slate-600">已知费用从列明金额逐项汇总，待确认项目单独保留。套餐名称相同，也需要核对实际施工范围。</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6" aria-labelledby="quote-demand">
        <h2 id="quote-demand">这次改造的需求</h2>
        <p className="text-slate-600">{demand.description}</p>
        <dl className="grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-3">
          <div><dt className="text-xs text-slate-500">城市 / 面积</dt><dd className="mt-1 font-semibold">{demand.city} · {demand.areaM2}㎡</dd></div>
          <div><dt className="text-xs text-slate-500">预算范围</dt><dd className="mt-1 font-semibold">{formatQuoteMoney(demand.budgetMinCents)} – {formatQuoteMoney(demand.budgetMaxCents)}</dd></div>
          <div><dt className="text-xs text-slate-500">期望工期</dt><dd className="mt-1 font-semibold">{demand.desiredDays} 天</dd></div>
        </dl>
      </section>

      <section aria-labelledby="quote-list">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="mb-0" id="quote-list">报价明细对比 · {response.data.length} 份</h2>
          <span className="text-sm text-slate-500">展示顺序不代表价格或质量排名</span>
        </div>
        <QuoteTable quotes={response.data} providers={providers} />
      </section>

      <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-6" aria-labelledby="quote-notes">
        <h2 className="text-base" id="quote-notes">确认范围后，才能比较最终费用</h2>
        <p className="text-sm text-amber-950">逐项核对数量、单位、材料、施工范围与增项约定。已知小计更低，不代表最终总价更低；明细全部定价，也不代表覆盖了完整需求。</p>
        <p className="mb-0 text-sm text-amber-950">预计天数是报价中的工期估计，不代表服务方档期已确认。本页用于查看报价，不代表接受报价或完成付款。</p>
      </aside>
      <Link className="inline-block text-sm" href={`/owner/demand/${id}`}>查看原始需求 →</Link>
    </div>
  );
}
