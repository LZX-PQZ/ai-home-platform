"use client";

import React, { useEffect, useState } from "react";
import type { DemandDTO } from "@/contracts";
import { StatusBadge } from "@/components/StatusBadge";
import {
  demandHallErrorMessage,
  formatBudget,
  loadDemandHall,
  type DemandHallState,
} from "./demand-hall";

const renovationLabels: Record<DemandDTO["renovationType"], string> = {
  elderly: "适老化改造",
  partial: "局部改造",
  repair: "维修",
};

export function DemandHallContent({
  state,
  onReload,
}: {
  state: DemandHallState;
  onReload: () => void;
}) {
  return (
    <section aria-labelledby="demand-hall-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 id="demand-hall-title">需求大厅</h1>
          <p>浏览已发布的装修需求，了解业主预算与期望工期。</p>
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
              : "刷新需求"}
        </button>
      </div>

      <p className="text-sm text-slate-600">
        当前为服务方演示入口，模拟数据仅用于演示，数据来源以加载后的标识为准。角色导航不代表登录鉴权。需求详情、报价提交和接单功能待接入。
      </p>

      {state.status === "loading" && (
        <div className="card" role="status" aria-live="polite">
          正在读取需求，请稍候…
        </div>
      )}

      {state.status === "error" && (
        <div className="card" role="alert">
          <h2>暂时无法加载需求</h2>
          <p>{state.message}</p>
        </div>
      )}

      {state.status === "ready" && (
        <>
          <div role="status" aria-live="polite">
            <StatusBadge
              label={
                state.response.meta.source === "mock"
                  ? "数据来源：模拟数据（mock）"
                  : "数据来源：实时接口（live）"
              }
            />
            <p className="mt-2 text-sm text-slate-600">
              {state.response.meta.source === "mock"
                ? "以下为接口返回的固定演示数据，不代表真实客户需求。"
                : "以下为需求接口返回的数据。"}
              仅展示已发布需求，共 {state.response.data.length} 条。
            </p>
          </div>

          {state.response.data.length === 0 ? (
            <div className="card">
              <h2>暂无已发布需求</h2>
              <p>当前没有可展示的需求，请稍后刷新。</p>
            </div>
          ) : (
            <ul aria-label="已发布需求列表" className="grid gap-x-6 md:grid-cols-2">
              {state.response.data.map((demand) => (
                <li key={demand.id} className="card min-w-0">
                  <article aria-labelledby={`demand-${demand.id}`}>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <StatusBadge label="已发布" />
                      <span className="text-sm text-slate-600">
                        {renovationLabels[demand.renovationType]}
                      </span>
                    </div>
                    <h2 id={`demand-${demand.id}`} className="break-words">
                      {demand.city} · {renovationLabels[demand.renovationType]}
                    </h2>
                    <p className="whitespace-pre-wrap break-words">
                      {demand.description || "业主暂未填写需求描述。"}
                    </p>
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                      <div className="min-w-0">
                        <dt className="text-slate-600">所在城市</dt>
                        <dd className="mt-1 break-words font-medium">{demand.city}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-600">改造面积</dt>
                        <dd className="mt-1 font-medium">{demand.areaM2} 平方米</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-slate-600">业主预算（人民币）</dt>
                        <dd className="mt-1 break-words text-lg font-semibold text-teal-800">
                          {formatBudget(demand.budgetMinCents)} – {formatBudget(demand.budgetMaxCents)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-600">期望工期</dt>
                        <dd className="mt-1 font-medium">{demand.desiredDays} 天</dd>
                      </div>
                    </dl>
                    <p className="mb-0 mt-4 break-all text-xs text-slate-500">
                      需求编号：{demand.id}
                    </p>
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

export function DemandHall() {
  const [state, setState] = useState<DemandHallState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    loadDemandHall().then(
      (response) => {
        if (active) setState({ status: "ready", response });
      },
      (error: unknown) => {
        if (active) setState({ status: "error", message: demandHallErrorMessage(error) });
      },
    );
    return () => {
      active = false;
    };
  }, [reloadKey]);

  function reload() {
    setState({ status: "loading" });
    setReloadKey((key) => key + 1);
  }

  return <DemandHallContent state={state} onReload={reload} />;
}
