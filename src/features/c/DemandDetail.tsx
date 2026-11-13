"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { formatBudget, renovationLabels } from "./demand-hall";
import {
  demandDetailErrorMessage,
  loadDemandDetail,
  type DemandDetailState,
} from "./demand-detail";

export function DemandDetailContent({
  demandId,
  state,
  onReload,
}: {
  demandId: string;
  state: DemandDetailState;
  onReload: () => void;
}) {
  const demand = state.status === "ready" ? state.response.data : null;

  return (
    <section aria-labelledby="demand-detail-title">
      <Link
        href="/provider"
        className="inline-block rounded underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      >
        返回需求大厅
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 id="demand-detail-title">需求详情</h1>
          <p className="break-all text-sm text-slate-600">需求编号：{demandId}</p>
        </div>
        <button
          type="button"
          onClick={onReload}
          disabled={state.status === "loading"}
          className="rounded-lg border border-teal-700 bg-white px-4 py-2 text-teal-800 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-wait disabled:opacity-60"
        >
          {state.status === "loading"
            ? "正在加载…"
            : state.status === "error"
              ? "重新加载"
              : "刷新详情"}
        </button>
      </div>
      <p className="text-sm text-slate-600">
        当前为服务方演示入口，模拟数据仅用于演示，数据来源以加载后的标识为准。角色导航不代表登录鉴权。
      </p>
      <p className="text-sm text-slate-600">
        详情从当前需求列表中读取；列表中未返回的需求暂时无法查看。
      </p>

      {state.status === "loading" && (
        <div className="card" role="status" aria-live="polite">
          正在读取需求详情，请稍候…
        </div>
      )}
      {state.status === "error" && (
        <div className="card" role="alert">
          <h2>暂时无法加载详情</h2>
          <p>{state.message}</p>
        </div>
      )}
      {state.status === "ready" && (
        <>
          <div role="status" aria-live="polite">
            <StatusBadge
              label={state.response.meta.source === "mock"
                ? "数据来源：模拟数据（mock）"
                : "数据来源：实时接口（live）"}
            />
            <p className="mt-2 text-sm text-slate-600">
              {state.response.meta.source === "mock"
                ? "当前接口返回固定演示数据，不代表真实客户需求。"
                : "数据来自需求接口。"}
            </p>
          </div>
          {demand ? (
            <>
              <article className="card min-w-0" aria-labelledby="demand-summary-title">
                <div className="mb-4"><StatusBadge label="已发布" /></div>
                <h2 id="demand-summary-title" className="break-words">
                  {demand.city} · {renovationLabels[demand.renovationType]}
                </h2>
                <h3 className="mt-6 font-semibold">需求描述</h3>
                <p className="mt-2 whitespace-pre-wrap break-words">
                  {demand.description || "业主暂未填写需求描述。"}
                </p>
                <dl className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-sm text-slate-600">所在城市</dt>
                    <dd className="mt-1 break-words font-medium">{demand.city}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-600">改造类型</dt>
                    <dd className="mt-1 font-medium">{renovationLabels[demand.renovationType]}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-600">改造面积</dt>
                    <dd className="mt-1 font-medium">{demand.areaM2} 平方米</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-600">期望工期</dt>
                    <dd className="mt-1 font-medium">{demand.desiredDays} 天</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-slate-600">业主预算（人民币）</dt>
                    <dd className="mt-1 break-words text-xl font-semibold text-teal-800">
                      {formatBudget(demand.budgetMinCents)} – {formatBudget(demand.budgetMaxCents)}
                    </dd>
                  </div>
                </dl>
                <p className="mb-0 mt-4 text-sm text-slate-600">以上为业主预算，实际报价待服务方确认。</p>
              </article>
              <section className="card" aria-labelledby="quote-pending-title">
                <h2 id="quote-pending-title">报价与接单</h2>
                <p className="mb-0">报价提交和接单功能待接入，当前仅支持查看需求。</p>
              </section>
            </>
          ) : (
            <div className="card" role="status" aria-live="polite">
              <h2>当前列表中未找到该已发布需求</h2>
              <p>该需求可能尚未发布、已不再公开，或未包含在当前列表中。请返回需求大厅或稍后重试。</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function DemandDetail({ demandId }: { demandId: string }) {
  const [state, setState] = useState<DemandDetailState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    loadDemandDetail(demandId).then(
      (response) => {
        if (active) setState({ status: "ready", response });
      },
      (error: unknown) => {
        if (active) setState({ status: "error", message: demandDetailErrorMessage(error) });
      },
    );
    return () => { active = false; };
  }, [demandId, reloadKey]);

  function reload() {
    setState({ status: "loading" });
    setReloadKey((key) => key + 1);
  }

  return <DemandDetailContent demandId={demandId} state={state} onReload={reload} />;
}
