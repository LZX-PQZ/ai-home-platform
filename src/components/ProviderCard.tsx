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
          <p className="text-sm text-slate-600">{provider.city} · 施工团队 · 评分 {provider.rating.toFixed(1)}/5</p>
        </div>
        <div className="shrink-0 rounded-xl bg-teal-50 px-4 py-3 text-center" aria-label={`匹配分 ${score}，满分 100`}>
          <strong className="text-3xl text-teal-800">{score}</strong>
          <div className="mt-1 text-xs text-teal-700">匹配分 / 100</div>
        </div>
      </div>
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
