"use client";

import React, { useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { Button, C, Empty } from "@/components/ui";
import { formatBudget, renovationLabels } from "./demand-hall";
import {
  adminDemandErrorMessage,
  adminDemandStatusLabels,
  adminDemandStatuses,
  loadAdminDemands,
  summarizeAdminDemands,
  type AdminDemandState,
} from "./admin-demand-overview";

export function AdminDemandOverviewContent({ state, onReload }: {
  state: AdminDemandState;
  onReload: () => void;
}) {
  const response = state.status === "ready" ? state.response : null;
  const summary = response ? summarizeAdminDemands(response.data) : null;

  return (
    <section aria-labelledby="admin-demand-title" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 id="admin-demand-title" className={C.pageTitle}>平台管理看板</h1>
          <p className={C.pageSub}>查看当前需求列表的状态、业主预算与期望工期。</p>
        </div>
        <Button onClick={onReload} variant="secondary" disabled={state.status === "loading"}
          className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          {state.status === "loading" ? "正在加载…" : state.status === "error" ? "重新加载" : "刷新概览"}
        </Button>
      </div>

      <div className={`${C.note} ${C.noteWarn}`}>
        <p>当前为平台管理演示入口，可能包含模拟数据，来源以加载后的标识为准。角色导航不代表登录鉴权。</p>
        <p className="!mb-0">统计范围仅为本次返回的需求列表，不代表平台全量数据。预算为业主预算，期望工期不等于实际工期；成交额、实际工期和售后统计尚未接入。</p>
      </div>

      {state.status === "loading" && <div className={C.card} role="status" aria-live="polite">正在读取需求概览，请稍候…</div>}
      {state.status === "error" && (
        <div className={`${C.card} border-danger/30`} role="alert">
          <h2>暂时无法加载需求概览</h2>
          <p className="!mb-0">{state.message}</p>
        </div>
      )}

      {response && summary && (
        <>
          <div role="status" aria-live="polite">
            <StatusBadge label={response.meta.source === "mock"
              ? response.data.length === 0 ? "列表来源：模拟标识（mock）" : "列表来源：含模拟数据（mock）"
              : "列表来源：实时接口（live）"} />
            <p className={`mt-2 !mb-0 ${C.pageSub}`}>
              {response.meta.source === "mock"
                ? response.data.length === 0
                  ? "本次为空列表，接口来源标记为 mock；没有可展示的需求。"
                  : "列表包含模拟数据，也可能包含实际创建的需求；本页尚未展示逐条来源，不能将每条记录都视为真实或模拟需求。"
                : "本次列表由实时接口返回，来源标识不代表已完成身份鉴权。"}
            </p>
          </div>

          <section aria-labelledby="admin-demand-counts-title">
            <h2 id="admin-demand-counts-title" className={C.sectionTitle}>本次列表状态分布</h2>
            <dl aria-label="本次列表需求数量" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className={`${C.card} !bg-brand-soft`}>
                <dt className="text-sm text-ink-2">列表需求数</dt>
                <dd className="mt-2 text-2xl font-semibold text-brand">{summary.total}</dd>
              </div>
              {adminDemandStatuses.map((status) => (
                <div key={status} className={C.card}>
                  <dt className="text-sm text-ink-2">{adminDemandStatusLabels[status]}</dt>
                  <dd className="mt-2 text-2xl font-semibold">{summary.byStatus[status]}</dd>
                </div>
              ))}
            </dl>
          </section>

          {response.data.length === 0 ? (
            <Empty title="本次列表暂无需求" hint="接口本次返回空列表，可稍后刷新；这不代表平台没有历史需求。" />
          ) : (
            <div role="region" aria-label="需求明细，可横向滚动" tabIndex={0}
              className={`${C.cardFlush} overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand`}>
              <table className="w-full min-w-[640px] table-fixed text-left text-sm">
                <caption className="p-5 text-left font-semibold text-ink">需求预算与期望工期（人民币）</caption>
                <thead className="border-y border-line bg-canvas text-ink-2">
                  <tr>
                    <th scope="col" className="w-[38%] px-5 py-3">需求</th>
                    <th scope="col" className="w-[16%] px-3 py-3">状态</th>
                    <th scope="col" className="w-[30%] px-3 py-3">业主预算</th>
                    <th scope="col" className="px-3 py-3">期望工期</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {response.data.map((demand) => (
                    <tr key={demand.id}>
                      <th scope="row" className="px-5 py-4 font-normal">
                        <span className="break-words font-medium">{demand.city || "城市未填写"} · {renovationLabels[demand.renovationType]}</span>
                        <span className={`mt-1 block break-all ${C.meta}`}>需求编号：{demand.id}</span>
                      </th>
                      <td className="px-3 py-4"><StatusBadge label={adminDemandStatusLabels[demand.status]} /></td>
                      <td className="break-words px-3 py-4">{formatBudget(demand.budgetMinCents)} – {formatBudget(demand.budgetMaxCents)}</td>
                      <td className="px-3 py-4">{demand.desiredDays} 天</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function AdminDemandOverview() {
  const [state, setState] = useState<AdminDemandState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    loadAdminDemands().then(
      (response) => { if (active) setState({ status: "ready", response }); },
      (error: unknown) => { if (active) setState({ status: "error", message: adminDemandErrorMessage(error) }); },
    );
    return () => { active = false; };
  }, [reloadKey]);

  function reload() {
    setState({ status: "loading" });
    setReloadKey((previous) => previous + 1);
  }

  return <AdminDemandOverviewContent state={state} onReload={reload} />;
}
