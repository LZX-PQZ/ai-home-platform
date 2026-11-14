import * as React from "react";
import type { z } from "zod";
import type { Match } from "@/contracts";

export function ProviderCard({ match, rank }: { match: z.infer<typeof Match>; rank: number }) {
  const { provider, score, reasons } = match;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-xs font-semibold tracking-wide text-teal-700">候选 {String(rank).padStart(2, "0")}</span>
          <h3 className="mb-2 mt-2 text-lg font-semibold">{provider.name}</h3>
          <p className="text-sm text-slate-600">{provider.city} · 施工团队 · 基础资料评分 {provider.rating}/5</p>
          <p className="text-xs text-slate-500">基础资料来源：{provider.source === "mock" ? "mock · 模拟资料" : provider.source === "live" ? "live" : "未知"}；此评分不是已完成接单评价均分。</p>
        </div>
        <div className="shrink-0 rounded-xl bg-teal-50 px-4 py-3 text-center" aria-label={`匹配分 ${score}，满分 100`}>
          <strong className="text-3xl text-teal-800">{score}</strong>
          <div className="mt-1 text-xs text-teal-700">匹配分 / 100</div>
        </div>
      </div>
      <section className="mb-4 rounded-xl bg-slate-50 p-4 text-sm" aria-label="已完成接单评价">
        <h4 className="text-sm">已完成接单的业主评价</h4>
        {provider.performance ? <>
          <p>{provider.performance.averageRating === null ? "暂无评价均分（无样本），不作为 0 分。" : `评价均分 ${provider.performance.averageRating.toFixed(2)}/5`}</p>
          <p>样本数：{provider.performance.reviewCount} 条{provider.performance.reviewCount < 3 && <span className="ml-2 font-semibold text-amber-800">样本少</span>}</p>
          <p>评价来源：{provider.performance.source === "mock" ? "mock · 模拟接单评价" : "live · 已保存的接单评价"}</p>
          <p className="break-all text-xs">服务端计算时间：<time dateTime={provider.performance.calculatedAt}>{provider.performance.calculatedAt}</time></p>
        </> : <p>评价汇总未提供，来源未知；不按 0 分处理，也不以基础资料评分补齐。</p>}
        <p className="mb-0 text-xs text-slate-500">业主评价不代表准时率、质量认证或信用分。</p>
      </section>
      <div className="mb-5 flex flex-wrap gap-2" aria-label="服务方擅长标签">
        {provider.tags.length ? provider.tags.map((tag, index) => (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600" key={`${tag}-${index}`}>{tag}</span>
        )) : <span className="text-sm text-slate-500">尚未填写擅长标签</span>}
      </div>
      <div className="border-t border-slate-100 pt-4">
        <h4 className="mb-3 text-sm font-semibold">为什么匹配</h4>
        <ul className="space-y-2 text-sm text-slate-600">
          {reasons.map((reason) => <li className="flex gap-2" key={reason}><span className="text-teal-600" aria-hidden="true">•</span><span>{reason}</span></li>)}
        </ul>
      </div>
    </article>
  );
}
