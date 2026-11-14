"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { MatchResults } from "@/features/b/MatchResults";
import { loadMatches, matchLoadErrorMessage, MatchDemandNotFound } from "@/features/b/load-matches";
import { Source, type ProviderDTO } from "@/contracts";

type MatchPageState =
  | { status: "loading" }
  | { status: "ready"; data: Awaited<ReturnType<typeof loadMatches>> }
  | { status: "not-found" }
  | { status: "error"; message: string };

export function MatchPageContent({ state, retry }: { state: MatchPageState; retry: () => void }) {
  if (state.status === "ready") return <div className="space-y-4"><div className="flex justify-end"><Button variant="secondary" onClick={retry}>刷新匹配</Button></div><MatchResults data={state.data} /></div>;
  return (
    <section className="card" aria-busy={state.status === "loading"}>
      <span className="badge">规则匹配 · 服务方接口当前提供模拟资料</span>
      <h1 className="mt-4">{state.status === "not-found" ? "需求未找到" : state.status === "error" ? "暂时无法展示匹配结果" : "正在读取需求和服务方资料"}</h1>
      {state.status === "loading" && <p role="status">加载完成后将分别标明需求与服务方来源，不会用演示需求替代这份需求。</p>}
      {state.status === "not-found" && <p role="status">这份需求不存在，请返回需求列表选择已有需求。</p>}
      {state.status === "error" && <p role="alert">{state.message}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-50" type="button" disabled={state.status === "loading"} onClick={retry}>{state.status === "loading" ? "加载中…" : "重新加载"}</button>
        <Link href="/owner">返回需求列表 →</Link>
      </div>
    </section>
  );
}

export function MatchPage({ demandId }: { demandId: string }) {
  const [attempt, retry] = React.useReducer((value: number) => value + 1, 0);
  const [selectedSource, setSelectedSource] = React.useState<NonNullable<ProviderDTO["source"]>>("live");
  const performanceSource = demandId === "demo-demand" ? selectedSource : "live";
  const [result, setResult] = React.useState<{ id: string; attempt: number; performanceSource: typeof performanceSource; state: MatchPageState } | null>(null);

  React.useEffect(() => {
    let active = true;
    void loadMatches(demandId, performanceSource).then(
      (data) => { if (active) setResult({ id: demandId, attempt, performanceSource, state: { status: "ready", data } }); },
      (error: unknown) => {
        if (active) setResult({ id: demandId, attempt, performanceSource, state: error instanceof MatchDemandNotFound
          ? { status: "not-found" }
          : { status: "error", message: matchLoadErrorMessage(error) } });
      },
    );
    return () => { active = false; };
  }, [demandId, attempt, performanceSource]);

  // 路由、口径或重试变化时立即隐藏旧结果；迟到的请求不能覆盖当前选择。
  const state: MatchPageState = result?.id === demandId && result.attempt === attempt && result.performanceSource === performanceSource ? result.state : { status: "loading" };
  return <div className="space-y-4">
    {demandId === "demo-demand" && <section className="card" aria-label="固定演示评价口径">
      <label className="block text-sm font-semibold" htmlFor="match-performance-source">评价统计来源（固定演示页）</label>
      <select id="match-performance-source" className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm sm:w-auto" value={selectedSource} onChange={event => setSelectedSource(Source.parse(event.target.value))}>
        <option value="live">live · 已保存的非模拟接单评价</option>
        <option value="mock">mock · 模拟接单评价（演示）</option>
      </select>
      <p className="mb-0 mt-3 text-sm text-slate-600">选择 mock 会读取模拟接单评价，仅用于演示；不代表真实口碑。不会用模拟评价补齐 live 的无样本结果，切换后重新读取。</p>
    </section>}
    <MatchPageContent state={state} retry={retry} />
  </div>;
}
