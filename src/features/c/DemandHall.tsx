"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { Button, C, Explainer, PageHeader } from "@/components/ui";
import { DemandSource } from "./DemandSource";
import { DemandAccessRecovery } from "./DemandAccessRecovery";
import {
  defaultDemandHallFilters,
  demandHallFailureState,
  demandHallRenovationOptions,
  filterHallDemands,
  formatBudget,
  loadDemandHall,
  renovationLabels,
  type DemandHallState,
  type DemandHallFilters,
} from "./demand-hall";

export function DemandHallContent({
  state,
  onReload,
  filters = defaultDemandHallFilters,
  onFiltersChange = () => {},
}: {
  state: DemandHallState;
  onReload: () => void;
  filters?: DemandHallFilters;
  onFiltersChange?: (filters: DemandHallFilters) => void;
}) {
  const visibleDemands = state.status === "ready" ? filterHallDemands(state.response.data, filters) : [];
  const hasFilters = filters.keyword.length > 0 || filters.renovationType !== "all";
  return (
    <section aria-labelledby="demand-hall-title">
      <PageHeader
        id="demand-hall-title"
        title="需求大厅"
        subtitle="浏览已发布的装修需求，了解业主预算与期望工期。"
        aside={
          <Button variant="secondary" onClick={onReload} disabled={state.status === "loading"}>
            {state.status === "loading"
              ? "正在加载…"
              : state.status === "error"
                ? "重新加载"
                : "刷新需求"}
          </Button>
        }
      />

      <Explainer summary="模拟数据、登录身份与报价范围说明">
        <p>
          当前为服务方演示入口，模拟数据仅用于演示，数据来源以加载后的标识为准。角色导航不代表登录鉴权。演示服务方可对非演示的已发布需求提交报价，接单关系可在“我的接单”查看；生产服务方认证尚未接入。
        </p>
        <aside aria-label="需求大厅登录提示">
          <p className="!mb-2">业主登录优先于服务方身份。同一浏览器已登录业主时，大厅仅显示该业主自己的已发布需求；切换角色导航不会退出登录。</p>
          <p className="!mb-2">演示公开需求大厅前，请先点击“退出业主登录”，再刷新需求（加载失败时点击“重新加载”）；或用两个浏览器分别演示业主和服务方。</p>
        </aside>
        {state.status === "ready" && (
          <p>
            接口来源标记针对整批返回数据；本页筛选后仅展示已发布需求。各条需求来源以卡片标识为准，未提供时显示未知；模拟需求不代表真实客户需求。
          </p>
        )}
      </Explainer>

      {state.status === "loading" && (
        <div className={C.card} role="status" aria-live="polite">
          正在读取需求，请稍候…
        </div>
      )}

      {state.status === "error" && (
        <div className={C.card} role="alert">
          <h2 className={C.sectionTitle}>暂时无法加载需求</h2>
          <p className="!mb-0">{state.message}</p>
          {state.canExitOwnerSession && <DemandAccessRecovery />}
        </div>
      )}

      {state.status === "ready" && (
        <>
          <div role="status" aria-live="polite" className="mb-4 flex flex-wrap items-center gap-3">
            <StatusBadge
              label={
                state.response.meta.source === "mock"
                  ? "列表接口来源：模拟标识（mock）"
                  : "列表接口来源：实时接口（live）"
              }
            />
            <span className={`num ${C.meta}`}>
              本次读取的已发布需求共 {state.response.data.length} 条。
            </span>
          </div>

          <section aria-labelledby="demand-hall-filters-title" className={`${C.card} mb-6 space-y-4`}>
            <div>
              <h2 id="demand-hall-filters-title" className={`!mb-1 ${C.sectionTitle}`}>筛选已发布需求</h2>
              <p className={`!mb-0 ${C.meta}`}>只筛选本次已读取的需求，不扩大当前登录身份的可见范围。筛选不重新请求接口；刷新保留条件并按最新结果重新筛选。</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <label htmlFor="demand-hall-keyword" className={`${C.label} ${C.labelText} mb-2`}>关键词</label>
                <input id="demand-hall-keyword" type="search" className={`${C.input} w-full min-w-0`}
                  value={filters.keyword} aria-describedby="demand-hall-keyword-hint"
                  onChange={event => onFiltersChange({ ...filters, keyword: event.target.value })} />
                <p id="demand-hall-keyword-hint" className={`${C.meta} mt-2 !mb-0`}>匹配需求编号、城市或描述；忽略首尾空格和字母大小写，按原文连续匹配。</p>
              </div>
              <div className="min-w-0">
                <label htmlFor="demand-hall-renovation" className={`${C.label} ${C.labelText} mb-2`}>改造类型</label>
                <select id="demand-hall-renovation" className={`${C.input} w-full min-w-0`} value={filters.renovationType}
                  onChange={event => onFiltersChange({ ...filters, renovationType: demandHallRenovationOptions.find(value => value === event.target.value) ?? "all" })}>
                  {demandHallRenovationOptions.map(value => <option key={value} value={value}>{value === "all" ? "全部类型" : renovationLabels[value]}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p role="status" aria-live="polite" className="num !mb-0 text-[15px] text-ink-2">当前显示 {visibleDemands.length} / {state.response.data.length} 条已发布需求。</p>
              {hasFilters && <Button type="button" variant="secondary" size="sm" onClick={() => onFiltersChange(defaultDemandHallFilters)}>清除筛选</Button>}
            </div>
          </section>

          {state.response.data.length === 0 ? (
            <div className={C.card}>
              <h2 className={C.sectionTitle}>暂无已发布需求</h2>
              <p className="!mb-0 text-ink-2">当前没有可展示的需求，请稍后刷新。</p>
            </div>
          ) : visibleDemands.length === 0 ? (
            <div className={C.card} role="status">
              <h2 className={C.sectionTitle}>没有符合筛选条件的需求</h2>
              <p className="!mb-0 text-ink-2">本次仍有已发布需求，可调整关键词、改造类型或清除筛选查看。</p>
            </div>
          ) : (
            <ul aria-label="已发布需求列表" className="m-0 grid list-none gap-6 p-0 md:grid-cols-2">
              {visibleDemands.map((demand) => (
                <li key={demand.id} className={`${C.card} flex min-w-0 flex-col`}>
                  <article aria-labelledby={`demand-${demand.id}`} className="flex flex-1 flex-col">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <StatusBadge label="已发布" />
                      <DemandSource source={demand.source} />
                    </div>
                    <h2 id={`demand-${demand.id}`} className={`!mb-2 break-words ${C.sectionTitle}`}>
                      {demand.city} {renovationLabels[demand.renovationType]}
                    </h2>
                    <p className="whitespace-pre-wrap break-words text-ink-2">
                      {demand.description || "业主暂未填写需求描述。"}
                    </p>
                    <dl className="num m-0 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-4">
                      <div className="col-span-2">
                        <dt className={C.meta}>业主预算（人民币）</dt>
                        <dd className="m-0 mt-0.5 break-words text-[20px] font-semibold text-brand-hover">
                          {formatBudget(demand.budgetMinCents)} – {formatBudget(demand.budgetMaxCents)}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className={C.meta}>所在城市</dt>
                        <dd className="m-0 mt-0.5 break-words font-medium">{demand.city}</dd>
                      </div>
                      <div>
                        <dt className={C.meta}>改造面积</dt>
                        <dd className="m-0 mt-0.5 font-medium">{demand.areaM2} 平方米</dd>
                      </div>
                      <div>
                        <dt className={C.meta}>期望工期</dt>
                        <dd className="m-0 mt-0.5 font-medium">{demand.desiredDays} 天</dd>
                      </div>
                    </dl>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
                      <span className={`break-all ${C.meta}`}>需求编号：{demand.id}</span>
                      <Link
                        href={`/provider/demand/${encodeURIComponent(demand.id)}`}
                        aria-label={`查看需求 ${demand.id} 的详情`}
                        className={`${C.btnBase} ${C.btnSecondary} ${C.btnSm}`}
                      >
                        查看需求详情
                      </Link>
                    </div>
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
  const [filters, setFilters] = useState<DemandHallFilters>(defaultDemandHallFilters);

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

  return <DemandHallContent state={state} onReload={reload} filters={filters} onFiltersChange={setFilters} />;
}
