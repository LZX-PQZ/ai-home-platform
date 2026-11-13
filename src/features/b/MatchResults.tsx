import * as React from "react";
import Link from "next/link";
import { ProviderCard } from "@/components/ProviderCard";
import { renovationLabels } from "@/lib/match";
import type { loadMatches } from "@/features/b/load-matches";

export function MatchResults({ data }: { data: Awaited<ReturnType<typeof loadMatches>> }) {
  const { demand, response, demandSource, providerSource } = data;
  const matches = response.data;
  const isMock = response.meta.source === "mock";
  const formatMoney = (cents: number) => `¥${(cents / 100).toLocaleString("zh-CN")}`;

  return (
    <div className="space-y-7">
      <header>
        <Link className="text-sm" href={`/owner/demand/${encodeURIComponent(demand.id)}`}>← 返回需求详情</Link>
        <div className="mb-3 mt-6 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800">服务方匹配</span>
          <span className="badge">{demandSource === undefined && providerSource === "live" ? "需求来源未知 · 规则匹配" : isMock ? "含模拟数据 · 规则匹配" : "规则匹配"}</span>
        </div>
        <h1>为这次改造，找到合适的施工团队</h1>
        <p className="max-w-2xl text-slate-600">先确认服务城市与工种，再按改造经验和评分排序。每一项推荐都有可查看的依据。</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6" aria-labelledby="demand-summary">
        <h2 id="demand-summary">你的改造需求</h2>
        <p className="text-sm text-slate-500">需求来源：{demandSource === "mock" ? "模拟数据" : demandSource === "live" ? "已保存的需求数据" : "未知（接口未提供逐条来源）"}</p>
        <p className="text-slate-600">{demand.description}</p>
        <dl className="grid grid-cols-2 gap-5 border-t border-slate-100 pt-5 md:grid-cols-4">
          <div><dt className="text-xs text-slate-500">城市 / 面积</dt><dd className="mt-1 font-semibold">{demand.city} · {demand.areaM2}㎡</dd></div>
          <div><dt className="text-xs text-slate-500">改造类型</dt><dd className="mt-1 font-semibold">{renovationLabels[demand.renovationType]}</dd></div>
          <div><dt className="text-xs text-slate-500">预算范围</dt><dd className="mt-1 font-semibold">{formatMoney(demand.budgetMinCents)} – {formatMoney(demand.budgetMaxCents)}</dd></div>
          <div><dt className="text-xs text-slate-500">期望工期</dt><dd className="mt-1 font-semibold">{demand.desiredDays} 天</dd></div>
        </dl>
      </section>

      <section aria-labelledby="matches-heading">
        <p className="text-sm text-slate-500">服务方来源：{providerSource === "mock" ? "模拟资料和样例评分" : "服务方接口数据"}</p>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="mb-0" id="matches-heading">{matches.length ? `${matches.length} 家符合城市与工种的候选团队` : providerSource === "mock" ? "当前模拟资料中暂未找到符合条件的团队" : "本次返回的资料中暂未找到符合条件的团队"}</h2>
          {matches.length > 0 && <span className="text-sm text-slate-500">按匹配分从高到低排列</span>}
        </div>
        {matches.length ? (
          <div className="grid gap-4 md:grid-cols-2">{matches.map((match, index) => <ProviderCard key={match.provider.id} match={match} rank={index + 1} />)}</div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center" role="status">
            <p>{providerSource === "mock"
              ? "当前服务方接口仅提供模拟资料，其中没有符合这份需求城市与工种的团队，不能据此判断是否存在真实可接单团队。"
              : "本次返回的服务方资料中，没有符合这份需求城市与工种的团队；这不代表当地没有施工团队。"}</p>
            <p className="text-sm text-slate-600">可以返回需求详情核对城市，或使用页面上方的“刷新匹配”重新读取资料。</p>
            <Link href={`/owner/demand/${encodeURIComponent(demand.id)}`}>查看需求详情 →</Link>
          </div>
        )}
      </section>

      <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-6" aria-labelledby="matching-notes">
        <h2 className="text-base" id="matching-notes">做决定前，还需要确认</h2>
        <p className="text-sm text-amber-950">匹配分 = 改造标签匹配 60 分 + 服务方评分 × 8（四舍五入，最高 40 分）。同分团队按固定顺序展示，先后不代表优劣。分数仅用于候选排序，不代表施工质量保证。</p>
        <p className="text-sm text-amber-950">服务方的报价、可接单日期和资质尚未核验。预算与期望工期只是你的需求，当前不作为已满足条件。</p>
        {providerSource === "mock" && <p className="text-sm text-amber-950">当前团队资料和评分均为模拟数据，未使用真实履约记录。</p>}
        <p className="mb-0 text-sm text-amber-950">匹配分由规则计算，未调用 AI 模型。</p>
      </aside>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-900 p-6 text-white">
        <div><h2 className="mb-1 text-lg">下一步：看清完整报价</h2><p className="mb-0 text-sm text-slate-300">逐项确认服务范围和未定费用，再决定与谁合作。</p></div>
        <Link className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-teal-800" href={`/owner/quotes/${encodeURIComponent(demand.id)}`}>查看该需求报价 →</Link>
      </div>
    </div>
  );
}
