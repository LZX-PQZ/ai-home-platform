"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button, C, Card, DataDisclosure, Empty, LinkButton, Note, PageHeader, SectionHead } from "./ui";
import { demandHref } from "./demand-list";
import { GanttChart } from "@/components/GanttChart";
import {
  activeTasks,
  blockedTasks,
  dayRangeLabel,
  dependencyNames,
  detectIssues,
  progressPercent,
  startableTasks,
  taskStatusLabel,
  taskStatusTone,
  toGanttRows,
  totalDays,
} from "./schedule";
import { useSchedule } from "./useSchedule";

/**
 * 业主端「施工进度」页。
 *
 * 三件事必须在第一屏看清楚：现在做到哪一步（甘特图 + 进度）、下一步什么时候轮到什么工序
 * （可开工任务）、计划本身有没有自相矛盾（排期自检）。
 * 数据只有 /api/schedule 一处来源，接口没给的字段（真实日期、责任人姓名、验收单）一律不编。
 */
export function SchedulePanel({ id }: { id: string }) {
  const { phase, data, source, error, reload } = useSchedule();
  const [actionNote, setActionNote] = useState<string | null>(null);

  if (phase === "loading") {
    return (
      <div>
        <PageHeader title="施工进度" subtitle={`正在读取需求 ${id} 的排期…`} />
        <DataDisclosure what="排期" />
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
        <DataDisclosure what="排期" />
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

  if (!data || data.tasks.length === 0) {
    return (
      <div>
        <PageHeader title="施工进度" subtitle="这条需求还没有排期" />
        <DataDisclosure what="排期" />
        <Empty
          title="接口没有返回任何工序"
          hint="排期由签约后生成（GET /api/schedule 目前返回固定演示数据）。本页不会凭空画一份计划出来。"
          action={
            <LinkButton href={demandHref(id)} size="sm" variant="secondary">返回需求详情</LinkButton>
          }
        />
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
  const mismatch = data.demandId !== id;

  // 接口只返回固定演示排期时，若它不属于当前需求，就一条数据都不渲染 ——
  // 画别人的甘特图再配一句警告，业主仍会误以为这是自己家的进度。
  if (mismatch) {
    return (
      <div>
        <div className="mb-3">
          <Link href={demandHref(id)} className="text-[13px] font-medium text-[#0F6E56]">
            ← 返回需求详情
          </Link>
        </div>
        <PageHeader title="施工进度" subtitle={`需求 ${id} · 还没有排期`} />
        <DataDisclosure what="排期" />
        <Empty
          title="这条需求还没有排期"
          hint={`接口目前只返回需求「${data.demandId}」的演示排期（GET /api/schedule 为固定数据），与当前需求不一致。排期要等签约后由施工方提交，本页不会把别的项目的排期画成这一条。`}
          action={
            <LinkButton href={demandHref(id)} size="sm" variant="secondary">返回需求详情</LinkButton>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3">
        <Link href={`/owner/demand/${id}`} className="text-[13px] font-medium text-[#0F6E56]">
          ← 返回需求详情
        </Link>
      </div>

      <PageHeader
        title="施工进度"
        subtitle={`需求 ${data.demandId} · 排期版本 v${data.version} · 数据来源 ${source ?? "未知"}`}
        aside={
          <Badge tone={blocked.length > 0 ? "danger" : running.length > 0 ? "brand" : "neutral"}>
            {blocked.length > 0 ? "有工序受阻" : running.length > 0 ? "施工中" : "未开工"}
          </Badge>
        }
      />

      <DataDisclosure what="排期" />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "计划总工期", value: `${days} 天`, hint: "取所有工序结束日的最大值" },
          { label: "已完成进度", value: `${percent}%`, hint: "按已完成工序的工期占比推算" },
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
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-[#EDF2F3]">
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
            <SectionHead title="下一步可开工" aside={<Badge tone="accent">{ready.length} 项</Badge>} />
            {ready.length === 0 ? (
              <p className={`!mb-0 ${C.meta}`}>
                没有满足「前置工序已全部完成」的待开工任务。若施工方说可以进场，说明排期数据没同步。
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
                  依赖关系完整、无重叠排期、同一时间只有一道主工序 —— 业主不会看到「两个人同时说在干同一件事」。
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

          <Card>
            <SectionHead title="变更与验收" />
            <p className={`!mb-3 ${C.meta}`}>
              排期变更、阶段验收都需要写回后端（POST /api/schedule），该接口目前返回 501。
            </p>
            <div className="grid gap-2">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() =>
                  setActionNote("申请变更需要 POST /api/schedule，该接口尚未实现（501）。已写进 docs/requests/A-schedule-payment.md，等 D 补齐。")
                }
              >
                申请排期变更
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() =>
                  setActionNote("验收确认需要 POST /api/schedule 与验收单字段，接口尚未实现。当前页面只读，不会伪造「已验收」状态。")
                }
              >
                确认阶段验收
              </Button>
            </div>
            {actionNote ? (
              <div className="mt-3">
                <Note tone="info">{actionNote}</Note>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
