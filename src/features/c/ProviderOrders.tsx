"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { Button, C, Empty } from "@/components/ui";
import { formatQuoteMoney } from "./quote-form";
import { QuoteSource } from "./QuoteSource";
import { ProviderQuoteDetails } from "./ProviderQuoteDetails";
import {
  defaultProviderQuoteFilters,
  filterProviderQuotes,
  loadProviderOrders,
  providerOrderStatusLabels,
  providerOrdersErrorMessage,
  providerQuoteStatusOptions,
  summarizeProviderOrders,
  type ProviderOrdersState,
  type ProviderQuoteFilters,
} from "./provider-orders";

function QuoteStatus({ status }: { status: keyof typeof providerOrderStatusLabels }) {
  return <StatusBadge label={providerOrderStatusLabels[status]} />;
}

export function ProviderOrdersContent({ state, onReload, filters = defaultProviderQuoteFilters, onFiltersChange = () => {} }: {
  state: ProviderOrdersState;
  onReload: () => void;
  filters?: ProviderQuoteFilters;
  onFiltersChange?: (filters: ProviderQuoteFilters) => void;
}) {
  const response = state.status === "ready" ? state.response : null;
  const summary = response ? summarizeProviderOrders(response.data) : null;
  const visibleQuotes = response ? filterProviderQuotes(response.data, filters) : [];
  const hasFilters = filters.status !== "all" || filters.keyword.length > 0;

  return (
    <section aria-labelledby="provider-orders-title" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="provider-orders-title" className={C.pageTitle}>本人报价</h2>
          <p className="text-ink-2">查看当前服务方已保存的报价及其状态；查询范围由服务端登录会话确定。</p>
        </div>
        <Button onClick={onReload} variant="secondary" disabled={state.status === "loading"}
          className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          {state.status === "loading" ? "正在加载…" : state.status === "error" ? "重新加载" : "刷新报价"}
        </Button>
      </div>

      <div className={`${C.note} ${C.noteWarn}`}>
        <p>目前仅支持演示服务方登录，角色导航不能代替登录。登录、退出或身份变化后，请手动刷新报价，重新验证当前会话。</p>
        <p className="!mb-0">此区域展示本人报价。报价已提交不等于接单，报价已接受也不证明已建立接单关系或履约安排；接单关系以上方“我的接单”查询结果为准。</p>
      </div>

      {state.status === "loading" && <div className={C.card} role="status" aria-live="polite">正在验证服务方会话并读取本人报价，请稍候…</div>}
      {state.status === "error" && (
        <div className={`${C.card} border-danger/30`} role="alert">
          <h2>暂时无法加载本人报价</h2>
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
                  ? "本次为空列表，演示身份查询标记为 mock；当前服务方没有已保存的报价。"
                  : "本次演示身份查询标记为 mock；报价可已持久化，不代表每条报价都未保存。"
                : "本次报价列表由实时接口返回，列表标识不能代替每条报价的来源。"}
            </p>
            <p className={`mt-2 !mb-0 ${C.pageSub}`}>每条报价以自己的来源字段为准，未提供时显示未知；来源标识不代表真实业务身份、业主已阅读报价或已履约。</p>
          </div>

          <section aria-labelledby="provider-order-counts-title">
            <h2 id="provider-order-counts-title" className={C.sectionTitle}>本次查询的本人报价状态</h2>
            <p className={C.pageSub}>仅统计本次返回的全部本人报价，不随下方筛选变化；记录按编号排列，不代表提交时间或成交顺序。</p>
            <dl aria-label="本人报价状态数量" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["draft", "submitted", "accepted", "rejected"] as const).map((status) => (
                <div key={status} className={C.card}>
                  <dt className="text-sm text-ink-2">{providerOrderStatusLabels[status]}</dt>
                  <dd className="mt-2 text-2xl font-semibold">{summary[status]}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="provider-quote-filters-title" className={`${C.card} space-y-4`}>
            <h3 id="provider-quote-filters-title" className={C.sectionTitle}>筛选本人报价</h3>
            <p id="provider-quote-filters-help" className={`!mb-0 ${C.pageSub}`}>状态与编号同时匹配。编号支持部分文字，不区分大小写，忽略输入首尾空格；仅搜索本次读取的报价编号和关联需求编号。刷新保留筛选条件。</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <label htmlFor="provider-quote-status" className={C.label}>报价状态</label>
                <select id="provider-quote-status" className={C.input} value={filters.status}
                  aria-describedby="provider-quote-filters-help"
                  onChange={event => onFiltersChange({ ...filters, status: event.target.value as ProviderQuoteFilters["status"] })}>
                  {providerQuoteStatusOptions.map(status => <option key={status} value={status}>{status === "all" ? "全部报价" : providerOrderStatusLabels[status]}</option>)}
                </select>
              </div>
              <div className="min-w-0">
                <label htmlFor="provider-quote-keyword" className={C.label}>报价或需求编号</label>
                <input id="provider-quote-keyword" type="search" className={C.input} value={filters.keyword}
                  aria-describedby="provider-quote-filters-help" autoComplete="off"
                  onChange={event => onFiltersChange({ ...filters, keyword: event.target.value })} />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p role="status" aria-live="polite" className={`!mb-0 ${C.pageSub}`}>显示 {visibleQuotes.length} / {response.data.length} 条本人报价。</p>
              <Button variant="secondary" size="sm" disabled={!hasFilters} onClick={() => onFiltersChange(defaultProviderQuoteFilters)}>清除报价筛选</Button>
            </div>
          </section>

          {response.data.length === 0 ? (
            <Empty title="当前服务方暂无报价记录" hint="本次已验证服务方会话，未查到本人已保存的报价；可前往需求大厅查看公开需求。" />
          ) : visibleQuotes.length === 0 ? (
            <Empty title="没有符合筛选条件的报价" hint="本次已读取到本人报价，可调整状态或编号，或清除报价筛选查看全部记录。" />
          ) : (
            <ul aria-label="本人报价列表" className="space-y-4">
              {visibleQuotes.map((quote) => {
                const hasPending = quote.pendingItems.length > 0 || quote.items.some((item) => item.unitPriceCents === null || item.amountCents === null);
                return (
                <li key={quote.id} className={C.card}>
                  <article aria-labelledby={`provider-quote-${quote.id}`}>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <QuoteStatus status={quote.status} />
                      <QuoteSource source={quote.source} />
                      <span className={`${C.meta} min-w-0 break-all`}>报价编号：{quote.id}</span>
                    </div>
                    <h2 id={`provider-quote-${quote.id}`} className="break-all">关联需求：{quote.demandId}</h2>
                    <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-ink-2">报价服务方编号</dt>
                        <dd className="mt-1 break-all font-medium">{quote.providerId}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-2">接口返回的已知金额小计</dt>
                        <dd className="mt-1 font-medium">{formatQuoteMoney(quote.knownTotalCents)}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-2">预计工期</dt>
                        <dd className="mt-1 font-medium">{quote.estimatedDays} 天</dd>
                      </div>
                      <div>
                        <dt className="text-ink-2">待确认费用</dt>
                        <dd className="mt-1 font-medium">{hasPending ? "有，完整总价未确定" : quote.items.length === 0 ? "未提供明细，无法确认" : "接口未列出"}</dd>
                      </div>
                    </dl>
                    <p className="mt-4 text-sm text-ink-2">已知小计不代表最终总价；未知费用不按零计算，预计工期不代表已确认开工安排。</p>
                    <ProviderQuoteDetails quote={quote} />
                    <Link href={`/provider/demand/${encodeURIComponent(quote.demandId)}`} prefetch={false}
                      className="mt-3 inline-block rounded-md font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                      查看关联需求
                    </Link>
                    <p className="mt-2 !mb-0 text-sm text-ink-2">需求不再公开发布或不可读取时，以详情页提示为准。</p>
                  </article>
                </li>
                );
              })}
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
  const [filters, setFilters] = useState<ProviderQuoteFilters>(defaultProviderQuoteFilters);

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

  return <ProviderOrdersContent state={state} onReload={reload} filters={filters} onFiltersChange={setFilters} />;
}
