"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button, C, Card, Empty, LinkButton, Note, PageHeader, SectionHead } from "./ui";
import { demandHref } from "./demand-list";
import { GanttChart } from "@/components/GanttChart";
import {
  activeTasks,
  blockedTasks,
  dayRangeLabel,
  dependencyNames,
  detectIssues,
  progressPercent,
  scheduleStatus,
  startableTasks,
  taskStatusLabel,
  taskStatusTone,
  toGanttRows,
  totalDays,
} from "./schedule";
import { useSchedule, type ScheduleState } from "./useSchedule";
import { PhotoInspectionPanel } from "./PhotoInspectionPanel";
import { ScheduleVersionControls } from "./ScheduleVersionControls";
import { ScheduleEditorPanel } from "./ScheduleEditorPanel";
import { canReviseSchedule } from "./schedule-editor";
import { OrderProgressPanel } from "./OrderProgressPanel";
import { useOwnerOrder } from "./useOwnerOrder";
import type { OwnerOrderState } from "./owner-order";

/**
 * 业主端「施工进度」页。
 *
 * 三件事必须在第一屏看清楚：现在做到哪一步（甘特图 + 进度）、下一步什么时候轮到什么工序
 * （可开工任务）、计划本身有没有自相矛盾（排期自检）。
 * 数据只有 /api/schedule 一处来源，接口没给的字段（真实日期、责任人姓名、验收单）一律不编。
 */
export function SchedulePanel({ id }: { id: string }) {
  return <DemandSchedulePanel key={id} id={id} />;
}

function DemandSchedulePanel({ id }: { id: string }) {
  const [version, setVersion] = useState<number | undefined>();
  const { reload, ...state } = useSchedule(id, version);
  const orderState = useOwnerOrder(id);
  const reloadAll = () => {
    reload();
    orderState.reload();
  };
  return <>
    <ScheduleVersionControls version={version} onSelect={next => {
      if (next === version) reloadAll();
      else setVersion(next);
    }} />
    <ScheduleContent key={version ?? "latest"} id={id} version={version} state={state} reload={reloadAll} orderState={orderState} reloadOrder={orderState.reload} />
  </>;
}

export function ScheduleContent({ id, version, state, reload, orderState = { phase: "loading" }, reloadOrder = () => {} }: {
  id: string;
  version?: number;
  state: ScheduleState;
  reload: () => void;
  orderState?: OwnerOrderState;
  reloadOrder?: () => void;
}) {
  const { phase, data, source, error } = state;

  if (phase === "loading") {
    return (
      <div>
        <PageHeader title="施工进度" subtitle={`正在读取需求 ${id} 的${version === undefined ? "最新排期" : `排期版本 v${version}`}…`} />
        <p className={C.meta} role="status">本页数据可能包含模拟数据，加载完成后显示具体来源。</p>
        <Card className="animate-pulse">
          <div className="mb-4 h-4 w-1/3 rounded bg-[#EDF2F3]" />
          <div className="grid gap-2">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-9 w-full rounded bg-[#F4F7F8]" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div>
        <PageHeader title="施工进度" subtitle="读取排期失败" />
        <Note tone="danger" title="接口请求失败">
          <p>{error}</p>
          <div className="mt-2">
            <Button variant="secondary" size="sm" onClick={() => void reload()}>
              重新加载
            </Button>
          </div>
        </Note>
      </div>
    );
  }

  if (data && data.demandId !== id) {
    return (
      <div>
        <PageHeader title="施工进度" subtitle={`未取得需求 ${id} 的排期`} />
        <Note tone="warn" title="这条排期不属于当前需求">
          <p>接口返回的排期属于需求「{data.demandId}」（来源：{source ?? "未确认"}），并非当前需求「{id}」。本页已停止展示该排期。</p>
          <p>返回数据与当前需求不一致；这不能证明当前需求没有排期，请重新加载。</p>
        </Note>
        <div className="mt-3 flex flex-wrap gap-2">
          <LinkButton href={demandHref(id)} variant="secondary" size="sm">返回需求详情</LinkButton>
          <Button variant="secondary" size="sm" onClick={reload}>重新加载</Button>
        </div>
      </div>
    );
  }

  if (data && version !== undefined && data.version !== version) {
    return <Note tone="danger" title="排期版本不一致">
      <p>接口返回的排期不是指定版本 v{version}，已停止展示。</p>
      <Button variant="secondary" size="sm" onClick={reload}>重新加载</Button>
    </Note>;
  }

  if (phase === "missing") {
    return (
      <div>
        <PageHeader title="施工进度" subtitle={version === undefined ? `需求 ${id} 暂无排期` : `需求 ${id} 未找到排期版本 v${version}`} />
        <Empty
          title={version === undefined ? "尚未找到这条需求的排期" : `未找到指定版本 v${version}`}
          hint={version === undefined ? "当前没有可读取的排期版本，请在负责人安排后重新加载。" : "这不代表该需求没有其他排期，请查询其他版本或返回最新排期。"}
          action={<LinkButton href={demandHref(id)} size="sm" variant="secondary">返回需求详情</LinkButton>}
        />
        <Button variant="secondary" size="sm" onClick={reload}>重新加载</Button>
        {version === undefined ? <div className="mt-4"><ScheduleEditorPanel demandId={id} mode="create" onSaved={reload} /></div> : null}
      </div>
    );
  }

  if (!data || data.tasks.length === 0) {
    return (
      <div>
        <PageHeader title="施工进度" subtitle={data ? `需求 ${id} · 排期版本 v${data.version}` : "未取得排期数据"} />
        <p className={C.meta}>排期来源：{source ?? "未确认"}{source === "mock" ? "（模拟数据）" : ""}</p>
        <Empty
          title="接口没有返回任何工序"
          hint="当前排期版本尚未包含工序，请联系施工负责人确认。"
          action={
            <LinkButton href={demandHref(id)} size="sm" variant="secondary">返回需求详情</LinkButton>
          }
        />
        <Button variant="secondary" size="sm" onClick={reload}>重新加载</Button>
      </div>
    );
  }

  const days = totalDays(data);
  const percent = progressPercent(data);
  const running = activeTasks(data);
  const blocked = blockedTasks(data);
  const ready = startableTasks(data);
  const issues = detectIssues(data);
  const rows = toGanttRows(data);
  const currentDay = running.length > 0 ? Math.min(...running.map((task) => task.startDay)) : null;
  const status = scheduleStatus(data);

  return (
    <div>
      <div className="mb-3">
        <Link href={demandHref(id)} className="text-[13px] font-medium text-[#0F6E56]">
          ← 返回需求详情
        </Link>
      </div>

      <PageHeader
        title="施工进度"
        subtitle={`需求 ${data.demandId} · 排期版本 v${data.version} · 数据来源 ${source ?? "未知"}`}
        aside={
          <div className="flex items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            <Button variant="secondary" size="sm" onClick={reload}>{version === undefined ? "刷新最新排期" : "刷新指定版本"}</Button>
          </div>
        }
      />

      <p className={C.meta}>
        {source === "mock" ? "本排期为模拟数据（mock），仅供演示。" : `排期来源：${source ?? "未确认"}。`}
        日期仅为计划中的相对天数，不能据此判断今天进度或是否延期。
      </p>
      {version !== undefined ? <Note tone="info">正在查看指定版本 v{version}，仅用于查阅；工序状态与统计属于该版本，不代表当前现场进度。</Note> : null}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "计划总工期", value: `${days} 天`, hint: "取所有工序结束日的最大值" },
          { label: "工序完成比例", value: `${percent}%`, hint: "按全部工序的计划时长加权，非日历进度" },
          { label: "进行中工序", value: `${running.length} 项`, hint: running[0]?.name ?? "暂无" },
          { label: "受阻工序", value: `${blocked.length} 项`, hint: blocked[0]?.name ?? "无" },
        ].map((item) => (
          <Card key={item.label} className="!p-4">
            <div className={C.meta}>{item.label}</div>
            <div className="mt-1 text-[22px] font-bold tracking-tight text-[#16242B]">
              {item.value}
            </div>
            <div className="mt-0.5 truncate text-[11.5px] text-[#7A8A90]" title={item.hint}>
              {item.hint}
            </div>
          </Card>
        ))}
      </div>

      <Card className="mb-4">
        <SectionHead
          title="工序时间轴"
          aside={
            <span className="text-[12px] text-[#7A8A90]">
              单位：天（第 1 天 = 开工首日）
            </span>
          }
        />
        <p className={`mb-3 ${C.meta}`}>完成比例 = 已完成工序的计划时长 ÷ 全部工序的计划时长。100% 仅表示工序状态全部为已完成，不代表验收通过。</p>
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-[#EDF2F3]" role="progressbar" aria-label="工序完成比例" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <div
            className="h-full rounded-full bg-[#0F6E56] transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <GanttChart rows={rows} totalDays={days} currentDay={currentDay} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Card>
          <SectionHead title="工序清单" aside={<span className={C.meta}>{data.tasks.length} 道工序</span>} />
          <ul className="grid gap-2">
            {data.tasks.map((task) => {
              const deps = dependencyNames(data, task);
              return (
                <li
                  key={task.id}
                  className="rounded-[10px] border border-[#EEF3F4] bg-[#FCFDFD] px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13.5px] font-medium text-[#16242B]">{task.name}</span>
                    <Badge tone={taskStatusTone(task.status)}>{taskStatusLabel(task.status)}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[#7A8A90]">
                    <span>{dayRangeLabel(task)}</span>
                    <span>工期 {task.durationDays} 天</span>
                    <span>
                      前置：{deps.length > 0 ? deps.join("、") : "无（开工工序）"}
                    </span>
                    <span>责任方：{task.responsibleProviderId ?? "待指派"}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <SectionHead title="前置条件已满足的待开工工序" aside={<Badge tone="accent">{ready.length} 项</Badge>} />
            <p className={`!mb-3 ${C.meta}`}>这里只核对前置工序状态；实际进场时间和现场条件仍需施工负责人确认。</p>
            {ready.length === 0 ? (
              <p className={`!mb-0 ${C.meta}`}>
                当前没有满足「前置工序已全部完成」的待开工任务。
              </p>
            ) : (
              <ul className="grid gap-2">
                {ready.map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="font-medium text-[#16242B]">{task.name}</span>
                    <span className="text-[11.5px] text-[#7A8A90]">
                      计划 {dayRangeLabel(task)} · {task.durationDays} 天
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionHead
              title="排期自检"
              aside={
                <Badge tone={issues.length > 0 ? "danger" : "brand"}>
                  {issues.length > 0 ? `${issues.length} 个问题` : "通过"}
                </Badge>
              }
            />
            {issues.length === 0 ? (
              <Note tone="ok">
                <p className="!mb-0">
                  当前检查未发现缺失依赖、前序未完成或前后工序时间冲突。此检查不替代施工负责人审核或现场验收。
                </p>
              </Note>
            ) : (
              <ul className="grid gap-2">
                {issues.map((issue, index) => (
                  <li key={`${issue.code}-${index}`}>
                    <Note tone="warn">
                      <p className="!mb-0">{issue.message}</p>
                    </Note>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {version === undefined && source === "live" && canReviseSchedule(data) ? <ScheduleEditorPanel demandId={id} mode="revision" schedule={data} onSaved={reload} /> : null}
          {version === undefined && source === "live" && !canReviseSchedule(data) ? <Card>
            <SectionHead title="变更与验收" />
            <Note tone="info"><p>排期仅能在全部工序尚未开工且未分配责任方时修订；当前版本请联系施工负责人处理。</p></Note>
          </Card> : null}
          {version === undefined && source === "mock" ? <Card>
            <SectionHead title="变更与验收" />
            <Note tone="info"><p>本排期为模拟数据，只读展示；演示需求不能创建或修订排期。</p></Note>
          </Card> : null}
        </div>
      </div>

      {version === undefined ? (
        <>
          <OrderProgressPanel
            demandId={id}
            order={orderState.phase === "ready" ? orderState.order : null}
            orderPhase={orderState.phase}
            orderError={orderState.phase === "failed" ? orderState.error : null}
            orderSource={orderState.phase === "ready" ? orderState.source : null}
            schedule={data}
            source={source}
            reload={reload}
            reloadOrder={reloadOrder}
          />
          <PhotoInspectionPanel demandId={id} />
        </>
      ) : null}
    </div>
  );
}
