"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { Button, C, Empty } from "@/components/ui";
import { ProviderOrderQuote } from "./ProviderOrderQuote";
import {
  filterServiceOrders, loadProviderServiceOrders, providerServiceOrdersErrorMessage,
  serviceOrderFilterLabels, serviceOrderFilterOptions, serviceOrderStatusLabels, summarizeServiceOrders,
  type ProviderServiceOrdersState, type ServiceOrderStatusFilter,
} from "./provider-service-orders";

export function ProviderServiceOrdersContent({ state, onReload, statusFilter, onStatusFilterChange }: {
  state: ProviderServiceOrdersState;
  onReload: () => void;
  statusFilter: ServiceOrderStatusFilter;
  onStatusFilterChange: (status: ServiceOrderStatusFilter) => void;
}) {
  const response = state.status === "ready" ? state.response : null;
  const summary = response ? summarizeServiceOrders(response.data) : null;
  const visibleOrders = response ? filterServiceOrders(response.data, statusFilter) : [];

  return (
    <section aria-labelledby="provider-service-orders-title" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 id="provider-service-orders-title" className={C.pageTitle}>我的接单</h1>
          <p className={C.pageSub}>查看当前服务方在平台保存的接单关系；查询范围由服务端登录会话确定。</p>
        </div>
        <Button onClick={onReload} variant="secondary" disabled={state.status === "loading"}>
          {state.status === "loading" ? "正在加载接单…" : state.status === "error" ? "重新加载接单" : "刷新接单"}
        </Button>
      </div>
      <div className={`${C.note} ${C.noteWarn}`}>
        <p>目前使用演示服务方身份，角色导航不能代替登录。登录、退出或身份变化后，请分别刷新接单和下方本人报价。</p>
        <p className="!mb-0">接单关系保存不代表签署法律合同、付款、开工或施工验收。本页只读，暂不提供取消、改选或履约状态修改。</p>
      </div>
      {state.status === "loading" && <div className={C.card} role="status">正在验证服务方会话并读取本人接单，请稍候…</div>}
      {state.status === "error" && (
        <div className={`${C.card} border-danger/30`} role="alert">
          <h2 className={C.sectionTitle}>暂时无法加载本人接单</h2>
          <p className="!mb-0">{state.message}</p>
        </div>
      )}
      {response && summary && (
        <>
          <div role="status" aria-live="polite">
            <StatusBadge label={response.meta.source === "mock" ? "接单列表来源：模拟标识（mock）" : "接单列表来源：实时接口（live）"} />
            <p className={`mt-2 !mb-0 ${C.pageSub}`}>
              {response.meta.source === "mock"
                ? "本次查询标记为 mock；演示身份下的接单关系可已实际保存，逐条来源以各记录为准。"
                : "本次接单列表由实时接口返回，逐条来源以各记录为准。"}
              来源标识不证明生产服务方认证或实际履约。
            </p>
            <p className={`mt-2 !mb-0 ${C.meta}`}>本次返回 {response.data.length} 条接单关系，按编号排列，不代表成交时间顺序。</p>
          </div>
          <section aria-labelledby="provider-order-filters-title" className={`${C.card} space-y-4`}>
            <h2 id="provider-order-filters-title" className={C.sectionTitle}>按接单状态查看</h2>
            <p className={`!mb-0 ${C.pageSub}`}>数量统计本次读取的全部本人接单，不随筛选变化。切换筛选不改变接单状态；刷新保留筛选条件，状态以最新读取结果为准。</p>
            <div role="group" aria-label="按接单状态筛选" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {serviceOrderFilterOptions.map(status => (
                <button
                  key={status}
                  type="button"
                  aria-pressed={statusFilter === status}
                  onClick={() => onStatusFilterChange(status)}
                  className={`${C.btnBase} ${statusFilter === status ? C.btnPrimary : C.btnSecondary} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
                >
                  {serviceOrderFilterLabels[status]}（{status === "all" ? summary.total : summary.byStatus[status]}）
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className={`!mb-0 ${C.pageSub}`} role="status" aria-live="polite">当前筛选：{serviceOrderFilterLabels[statusFilter]}，显示 {visibleOrders.length} / {summary.total} 条接单。</p>
              {statusFilter !== "all" && <Button variant="secondary" size="sm" onClick={() => onStatusFilterChange("all")}>清除状态筛选</Button>}
            </div>
          </section>
          {response.data.length === 0 ? (
            <Empty title="当前服务方暂无接单关系" hint="本次已验证服务方会话，未查到本人接单关系。仅有已提交或历史已接受报价，不会自动生成接单。" />
          ) : visibleOrders.length === 0 ? (
            <Empty title="当前状态下没有接单" hint="本次列表中有其他状态的接单，可切换状态或清除状态筛选查看。" />
          ) : (
            <ul aria-label="本人接单列表" className="space-y-4">
              {visibleOrders.map(order => (
                <li key={order.id}>
                  <article aria-label={`接单 ${order.id}`} className={`${C.card} min-w-0`}>
                    <div className="mb-3 flex flex-wrap gap-2">
                      <StatusBadge label={serviceOrderStatusLabels[order.status]} />
                      <StatusBadge label={order.source === "mock" ? "本条接单来源：模拟标识（mock）" : "本条接单来源：实时记录（live）"} />
                    </div>
                    <h2 className={`${C.sectionTitle} break-all`}>接单关系编号：{order.id}</h2>
                    <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
                      <div className="min-w-0">
                        <dt className="text-ink-2">关联需求编号</dt>
                        <dd className="mt-1 break-all">
                          <Link
                            href={`/provider/demand/${encodeURIComponent(order.demandId)}`}
                            prefetch={false}
                            aria-label={`查看关联需求 ${order.demandId}`}
                            className="rounded underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                          >{order.demandId}</Link>
                        </dd>
                      </div>
                      <div className="min-w-0"><dt className="text-ink-2">已接受报价编号</dt><dd className="mt-1 break-all">{order.acceptedQuoteId}</dd></div>
                      <div className="min-w-0"><dt className="text-ink-2">接单服务方编号</dt><dd className="mt-1 break-all">{order.providerId}</dd></div>
                    </dl>
                    <ProviderOrderQuote order={order} />
                  </article>
                </li>
              ))}
            </ul>
          )}
          <p className={`!mb-0 ${C.pageSub}`}>可在接单内查看已接受报价，也可按编号核对下方本人报价。接单摘要不含费用或工期；报价中待确认费用仍需核实。</p>
        </>
      )}
    </section>
  );
}

export function ProviderServiceOrders() {
  const [state, setState] = useState<ProviderServiceOrdersState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState<ServiceOrderStatusFilter>("all");
  useEffect(() => {
    let active = true;
    loadProviderServiceOrders().then(
      response => { if (active) setState({ status: "ready", response }); },
      error => { if (active) setState({ status: "error", message: providerServiceOrdersErrorMessage(error) }); },
    );
    return () => { active = false; };
  }, [reloadKey]);

  function reload() {
    setState({ status: "loading" });
    setReloadKey(previous => previous + 1);
  }
  return <ProviderServiceOrdersContent state={state} onReload={reload} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} />;
}
