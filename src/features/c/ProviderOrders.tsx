"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { Button, C, Empty } from "@/components/ui";
import { formatBudget } from "./demand-hall";
import { QuoteSource } from "./QuoteSource";
import {
  loadProviderOrders,
  providerOrderStatusLabels,
  providerOrdersErrorMessage,
  summarizeProviderOrders,
  type ProviderOrdersState,
} from "./provider-orders";

function QuoteStatus({ status }: { status: keyof typeof providerOrderStatusLabels }) {
  return <StatusBadge label={providerOrderStatusLabels[status]} />;
}

export function ProviderOrdersContent({ state, onReload }: {
  state: ProviderOrdersState;
  onReload: () => void;
}) {
  const response = state.status === "ready" ? state.response : null;
  const summary = response ? summarizeProviderOrders(response.data) : null;

  return (
    <section aria-labelledby="provider-orders-title" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 id="provider-orders-title">我的接单</h1>
          <p className="text-ink-2">查看报价接口返回的状态，区分已确认承接与仍待业主确认的报价。</p>
        </div>
        <Button onClick={onReload} variant="secondary" disabled={state.status === "loading"}
          className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          {state.status === "loading" ? "正在加载…" : state.status === "error" ? "重新加载" : "刷新接单"}
        </Button>
      </div>

      <div className={`${C.note} ${C.noteWarn}`}>
        <p>当前为服务方演示入口，数据来源以加载后的标识为准。角色导航不代表登录鉴权。</p>
        <p className="!mb-0">当前报价接口尚未按已验证服务方身份过滤，以下记录仅代表本次接口返回范围，不能据此认定为你的真实接单或履约安排。</p>
      </div>

      {state.status === "loading" && <div className={C.card} role="status" aria-live="polite">正在读取接单记录，请稍候…</div>}
      {state.status === "error" && (
        <div className={`${C.card} border-danger/30`} role="alert">
          <h2>暂时无法加载接单记录</h2>
          <p className="!mb-0">{state.message}</p>
        </div>
      )}

      {response && summary && (
        <>
          <div role="status" aria-live="polite">
            <StatusBadge label={response.meta.source === "mock" ? "报价列表来源：模拟标识（mock）" : "报价列表来源：实时接口（live）"} />
            <p className={`mt-2 !mb-0 ${C.pageSub}`}>
              {response.meta.source === "mock"
                ? response.data.length === 0
                  ? "本次为空列表，接口来源标记为 mock；没有可展示的报价。"
                  : "本次列表标记为 mock，可能包含模拟或来源未确认的数据；不代表每条报价都未保存。"
                : "本次报价列表由实时接口返回，列表标识不能代替每条报价的来源。"}
            </p>
            <p className={`mt-2 !mb-0 ${C.pageSub}`}>每条报价以自己的来源字段为准，未提供时显示未知；来源标识不代表真实业务身份、业主已收到报价或已履约。</p>
          </div>

          <section aria-labelledby="provider-order-counts-title">
            <h2 id="provider-order-counts-title" className={C.sectionTitle}>本次返回的报价状态</h2>
            <p className={C.pageSub}>统计范围仅为本次报价接口返回的记录，不代表平台全量接单。</p>
            <dl aria-label="本次返回的报价状态数量" className="grid grid-cols-2 gap-3">
              <div className={`${C.card} !bg-brand-soft`}>
                <dt className="text-sm text-ink-2">已确认承接</dt>
                <dd className="mt-2 text-2xl font-semibold text-brand">{summary.accepted}</dd>
              </div>
              <div className={C.card}>
                <dt className="text-sm text-ink-2">待业主确认</dt>
                <dd className="mt-2 text-2xl font-semibold">{summary.submitted}</dd>
              </div>
            </dl>
          </section>

          {response.data.length === 0 ? (
            <Empty title="本次接口暂无报价记录" hint="接口返回空列表，可稍后刷新；这不代表平台没有历史接单或报价。" />
          ) : (
            <ul aria-label="本次接口返回的报价列表" className="space-y-4">
              {response.data.map((quote) => (
                <li key={quote.id} className={C.card}>
                  <article aria-labelledby={`provider-quote-${quote.id}`}>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <QuoteStatus status={quote.status} />
                      <QuoteSource source={quote.source} />
                      <span className={C.meta}>报价编号：{quote.id}</span>
                    </div>
                    <h2 id={`provider-quote-${quote.id}`} className="break-all">关联需求：{quote.demandId}</h2>
                    <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-ink-2">报价服务方编号</dt>
                        <dd className="mt-1 break-all font-medium">{quote.providerId}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-2">接口返回的已知金额小计</dt>
                        <dd className="mt-1 font-medium">{formatBudget(quote.knownTotalCents)}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-2">预计工期</dt>
                        <dd className="mt-1 font-medium">{quote.estimatedDays} 天</dd>
                      </div>
                      <div>
                        <dt className="text-ink-2">待确认费用</dt>
                        <dd className="mt-1 font-medium">{quote.pendingItems.length ? `${quote.pendingItems.length} 项` : "无"}</dd>
                      </div>
                    </dl>
                    <p className="mt-4 text-sm text-ink-2">{quote.pendingItems.length ? "仍有费用待确认，不能把已知小计当作最终总价。" : "当前没有待确认费用，但报价状态仍以接口返回为准。"}</p>
                    <Link href={`/provider/demand/${encodeURIComponent(quote.demandId)}`} prefetch={false}
                      className="mt-3 inline-block rounded-md font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                      查看关联需求
                    </Link>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

export function ProviderOrders() {
  const [state, setState] = useState<ProviderOrdersState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    loadProviderOrders().then(
      (response) => { if (active) setState({ status: "ready", response }); },
      (error: unknown) => { if (active) setState({ status: "error", message: providerOrdersErrorMessage(error) }); },
    );
    return () => { active = false; };
  }, [reloadKey]);

  function reload() {
    setState({ status: "loading" });
    setReloadKey((previous) => previous + 1);
  }

  return <ProviderOrdersContent state={state} onReload={reload} />;
}
