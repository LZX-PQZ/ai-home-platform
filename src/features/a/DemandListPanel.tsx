"use client";

import { Badge, Button, C, Card, Empty, LinkButton, Note, PageHeader } from "./ui";
import {
  STAGES,
  demandHref,
  demandTitle,
  formatBudget,
  isPostContract,
  paymentsHref,
  projectHref,
  stageIndex,
  statusLabel,
  statusTone,
} from "./demand-list";
import { itemSourceBadge, listSourceNote } from "./demand-source";
import { useDemandList, type DemandListState } from "./useDemandList";

/** 加载骨架：让「正在取数据」和「没有数据」在视觉上区分开 */
function SkeletonCard() {
  return (
    <div className={`${C.card} animate-pulse`}>
      <div className="mb-3 h-4 w-2/3 rounded bg-[#EDF2F3]" />
      <div className="mb-2 h-3 w-full rounded bg-[#F4F7F8]" />
      <div className="h-3 w-4/5 rounded bg-[#F4F7F8]" />
      <div className="mt-4 h-3 w-1/2 rounded bg-[#EDF2F3]" />
    </div>
  );
}

/** 五阶段进度条：已走过的高亮成浅绿，当前阶段实心，未到的置灰 */
function StageBar({ status }: { status: Parameters<typeof stageIndex>[0] }) {
  const current = stageIndex(status);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STAGES.map((stage, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <span
            key={stage.status}
            className={`rounded-full px-2 py-0.5 text-[11px] ${
              active
                ? "bg-[#0F6E56] font-medium text-white"
                : done
                  ? "bg-[#E7F3EF] text-[#0C5A47]"
                  : "bg-[#F0F3F4] text-[#A8B4B8]"
            }`}
          >
            {stage.label}
          </span>
        );
      })}
    </div>
  );
}

export function DemandListPanel() {
  const { reload, ...state } = useDemandList();
  return <DemandListContent state={state} reload={reload} />;
}

export function DemandListContent({ state, reload }: { state: DemandListState; reload: () => void }) {
  const { phase, items, source, error } = state;

  return (
    <div>
      <PageHeader
        title="我的装修"
        subtitle="一份需求单贯穿澄清、匹配、报价与施工；点开任意一条可以看完整信息。"
        aside={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={reload} disabled={phase === "loading"}>
              {phase === "loading" ? "刷新中…" : "刷新列表"}
            </Button>
            <LinkButton href="/owner/demand/chat">发起新需求</LinkButton>
          </div>
        }
      />

      <div className="mt-3 mb-3 flex flex-wrap items-center gap-2">
        <Badge tone={source === "live" ? "brand" : source === "mock" ? "accent" : "neutral"}>
          列表接口来源：{source ?? "未确认"}
        </Badge>
        <span className={C.meta}>
          {phase === "ready" ? `${items.length} 条需求` : phase === "loading" ? "加载中" : "加载失败"}
        </span>
      </div>

      {phase === "ready" && (
        <div className="mb-3">
          <Note tone={source === "mock" ? "warn" : "info"}>{listSourceNote(source)}</Note>
        </div>
      )}

      {phase === "loading" && (
        <>
          <p className={C.meta} role="status">本页数据可能包含模拟数据，加载完成后显示具体来源。</p>
          <div className="grid gap-3 md:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </>
      )}

      {phase === "failed" && (
        <Note tone="danger" title="需求列表加载失败">
          <p>{error}</p>
          <div className="mt-2">
            <Button variant="secondary" size="sm" onClick={() => void reload()}>
              重新加载
            </Button>
          </div>
        </Note>
      )}

      {phase === "ready" && items.length === 0 && (
        <Empty
          title="还没有需求单"
          hint="先描述房子的情况和想改的地方，再核对并填写需求单；当前聊天为 mock 固定追问。"
          action={
            <LinkButton href="/owner/demand/chat" size="sm">去发起需求</LinkButton>
          }
        />
      )}

      {phase === "ready" && items.length > 0 && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((demand) => (
              <Card key={demand.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className={`!mb-1 ${C.sectionTitle}`}>{demandTitle(demand)}</h2>
                      {itemSourceBadge(demand) ? <Badge tone="accent">{itemSourceBadge(demand)}</Badge> : null}
                    </div>
                    <p className={`!mb-0 ${C.meta}`}>需求编号：{demand.id}</p>
                  </div>
                  <Badge tone={statusTone(demand.status)}>{statusLabel(demand.status)}</Badge>
                </div>

                <p className="!mb-0 line-clamp-2 text-[13px] leading-relaxed text-[#4A5A60]">
                  {demand.description}
                </p>

                <StageBar status={demand.status} />

                <dl className="grid grid-cols-3 gap-2 rounded-[10px] bg-[#F7FAFA] px-3 py-2.5">
                  <div>
                    <dt className={C.meta}>预算</dt>
                    <dd className="!mb-0 text-[13px] font-medium text-[#16242B]">
                      {formatBudget(demand.budgetMinCents, demand.budgetMaxCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className={C.meta}>期望工期</dt>
                    <dd className="!mb-0 text-[13px] font-medium text-[#16242B]">
                      {demand.desiredDays} 天
                    </dd>
                  </div>
                  <div>
                    <dt className={C.meta}>面积</dt>
                    <dd className="!mb-0 text-[13px] font-medium text-[#16242B]">
                      {demand.areaM2} ㎡
                    </dd>
                  </div>
                </dl>

                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <LinkButton href={demandHref(demand.id)} size="sm">查看需求详情</LinkButton>
                  {isPostContract(demand.status) ? (
                    <>
                      <LinkButton href={projectHref(demand.id)} variant="secondary" size="sm">施工进度</LinkButton>
                      <LinkButton href={paymentsHref(demand.id)} variant="ghost" size="sm">节点付款</LinkButton>
                    </>
                  ) : (
                    <>
                      <LinkButton href={`/owner/matches/${encodeURIComponent(demand.id)}`} variant="secondary" size="sm">找服务方</LinkButton>
                      <LinkButton href={`/owner/quotes/${encodeURIComponent(demand.id)}`} variant="ghost" size="sm">看报价</LinkButton>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>

        </>
      )}
    </div>
  );
}
