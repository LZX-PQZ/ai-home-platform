"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { DemandSource } from "./DemandSource";
import { DemandAccessRecovery } from "./DemandAccessRecovery";
import {
  demandHallFailureState,
  formatBudget,
  loadDemandHall,
  renovationLabels,
  type DemandHallState,
} from "./demand-hall";

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
        当前为服务方演示入口，模拟数据仅用于演示，数据来源以加载后的标识为准。角色导航不代表登录鉴权。演示服务方可对非演示的已发布需求提交报价，真实接单功能仍待接入。
      </p>

      <aside aria-label="需求大厅登录提示" className="my-4 rounded-lg border border-line bg-canvas p-4 text-sm text-ink-2">
        <p className="!mb-2">业主登录优先于服务方身份。同一浏览器已登录业主时，大厅仅显示该业主自己的已发布需求；切换角色导航不会退出登录。</p>
        <p className="!mb-0">演示公开需求大厅前，请先点击“退出业主登录”，再刷新需求（加载失败时点击“重新加载”）；或用两个浏览器分别演示业主和服务方。</p>
      </aside>

      {state.status === "loading" && (
        <div className="card" role="status" aria-live="polite">
          正在读取需求，请稍候…
        </div>
      )}

      {state.status === "error" && (
        <div className="card" role="alert">
          <h2>暂时无法加载需求</h2>
          <p>{state.message}</p>
          {state.canExitOwnerSession && <DemandAccessRecovery />}
        </div>
      )}

      {state.status === "ready" && (
        <>
          <div role="status" aria-live="polite">
            <StatusBadge
              label={
                state.response.meta.source === "mock"
                  ? "列表接口来源：模拟标识（mock）"
                  : "列表接口来源：实时接口（live）"
              }
            />
            <p className="mt-2 text-sm text-slate-600">
              接口来源标记针对整批返回数据；本页筛选后仅展示已发布需求。各条需求来源以卡片标识为准，未提供时显示未知；模拟需求不代表真实客户需求。
              当前共 {state.response.data.length} 条。
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
                      <DemandSource source={demand.source} />
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
                    <Link
                      href={`/provider/demand/${encodeURIComponent(demand.id)}`}
                      aria-label={`查看需求 ${demand.id} 的详情`}
                      className="mt-4 inline-block rounded-lg border border-teal-700 px-4 py-2 text-sm font-medium hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                    >
                      查看需求详情
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
        if (active) setState(demandHallFailureState(error));
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
