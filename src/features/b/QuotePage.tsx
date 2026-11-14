"use client";

import * as React from "react";
import Link from "next/link";
import { Badge, Button, Card } from "@/components/ui";
import { QuoteComparison } from "@/features/b/QuoteComparison";
import { loadQuoteComparison, quoteLoadErrorMessage, QuoteDemandNotFound } from "@/features/b/load-quotes";
import { quoteReadFeedback } from "@/features/b/quote-feedback";
import { subscribeQuotePageRefresh } from "@/features/b/quote-page-refresh";

type QuotePageState =
  | { status: "loading" }
  | { status: "ready"; data: Awaited<ReturnType<typeof loadQuoteComparison>>; readAt: number }
  | { status: "not-found" }
  | { status: "error"; message: string };

export function QuotePageContent({ state, retry }: { state: QuotePageState; retry: () => void }) {
  if (state.status === "ready") return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line bg-white p-4">
        <div className="text-sm text-ink-2" role="status" aria-live="polite" aria-atomic="true">
          <p className="mb-1">{quoteReadFeedback(state.data)}</p>
          <p className="mb-0 text-xs text-ink-3">
            本次读取完成时间（本机时间）：<time dateTime={new Date(state.readAt).toISOString()}>{new Date(state.readAt).toLocaleString("zh-CN", { hour12: false })}</time>
            ；不代表报价的提交时间。
          </p>
          <p className="mb-0 mt-1 text-xs text-ink-3">返回此页面时会重新读取，也可点击“刷新报价”。</p>
        </div>
        <Button variant="secondary" onClick={retry}>刷新报价</Button>
      </div>
      <QuoteComparison data={state.data} />
    </div>
  );
  return (
    <Card>
      <div aria-busy={state.status === "loading"}>
        <Badge tone="accent">本人需求 · 报价对比</Badge>
        <h1 className="mt-4">{state.status === "not-found" ? "需求未找到" : state.status === "error" ? "暂时无法展示报价" : "正在读取需求和报价"}</h1>
        {state.status === "loading" && <p role="status">正在核对这份需求及其报价，加载完成后将分别显示数据来源。</p>}
        {state.status === "not-found" && <p role="status">这份需求不存在或不属于当前业主，请返回需求列表核对。</p>}
        {state.status === "error" && <p role="alert">{state.message}</p>}
        <div className="flex flex-wrap items-center gap-4">
          <Button disabled={state.status === "loading"} onClick={retry}>{state.status === "loading" ? "加载中…" : "重新加载"}</Button>
          <Link href="/owner">返回需求列表 →</Link>
        </div>
      </div>
    </Card>
  );
}

export function QuotePage({ demandId }: { demandId: string }) {
  const [attempt, retry] = React.useReducer((value: number) => value + 1, 0);
  const [result, setResult] = React.useState<{ id: string; attempt: number; state: QuotePageState } | null>(null);
  React.useEffect(() => subscribeQuotePageRefresh(retry, window, document), [retry]);
  React.useEffect(() => {
    let active = true;
    void loadQuoteComparison(demandId).then(
      (data) => { if (active) setResult({ id: demandId, attempt, state: { status: "ready", data, readAt: Date.now() } }); },
      (error: unknown) => {
        if (active) setResult({ id: demandId, attempt, state: error instanceof QuoteDemandNotFound
          ? { status: "not-found" }
          : { status: "error", message: quoteLoadErrorMessage(error) } });
      },
    );
    return () => { active = false; };
  }, [demandId, attempt]);

  // 更换需求或刷新立即隐藏旧报价，迟到的响应不能覆盖新需求。
  const state: QuotePageState = result?.id === demandId && result.attempt === attempt ? result.state : { status: "loading" };
  return <QuotePageContent state={state} retry={retry} />;
}
