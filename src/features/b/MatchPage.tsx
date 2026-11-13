"use client";

import * as React from "react";
import Link from "next/link";
import { MatchResults } from "@/features/b/MatchResults";
import { loadMatches, matchLoadErrorMessage, MatchDemandNotFound } from "@/features/b/load-matches";

type MatchPageState =
  | { status: "loading" }
  | { status: "ready"; data: Awaited<ReturnType<typeof loadMatches>> }
  | { status: "not-found" }
  | { status: "error"; message: string };

export function MatchPageContent({ state, retry }: { state: MatchPageState; retry: () => void }) {
  if (state.status === "ready") return <MatchResults data={state.data} />;
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
  const [result, setResult] = React.useState<{ id: string; attempt: number; state: MatchPageState } | null>(null);

  React.useEffect(() => {
    let active = true;
    void loadMatches(demandId).then(
      (data) => { if (active) setResult({ id: demandId, attempt, state: { status: "ready", data } }); },
      (error: unknown) => {
        if (active) setResult({ id: demandId, attempt, state: error instanceof MatchDemandNotFound
          ? { status: "not-found" }
          : { status: "error", message: matchLoadErrorMessage(error) } });
      },
    );
    return () => { active = false; };
  }, [demandId, attempt]);

  // 路由或重试变化时立即隐藏旧结果；迟到的请求不能覆盖当前需求。
  const state: MatchPageState = result?.id === demandId && result.attempt === attempt ? result.state : { status: "loading" };
  return <MatchPageContent state={state} retry={retry} />;
}
