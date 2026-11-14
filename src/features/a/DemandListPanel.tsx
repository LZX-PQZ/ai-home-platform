"use client";

import { useState } from "react";
import { Explainer, FulfillmentRuler } from "@/components/ui";
import { Badge, Button, C, Card, Empty, Field, LinkButton, Note, PageHeader } from "./ui";
import {
  STAGES,
  demandHref,
  demandTitle,
  formatBudget,
  filterDemands,
  isPostContract,
  paymentsHref,
  projectHref,
  statusLabel,
  statusTone,
  type DemandStatusFilter,
} from "./demand-list";
import { itemSourceBadge, listSourceNote } from "./demand-source";
import { useDemandList, type DemandListState } from "./useDemandList";

/** 加载骨架：让「正在取数据」和「没有数据」在视觉上区分开 */
function SkeletonCard() {
  return (
    <div className={`${C.card} animate-pulse`}>
      <div className="mb-3 h-4 w-2/3 rounded bg-mist" />
      <div className="mb-2 h-3 w-full rounded bg-canvas" />
      <div className="h-3 w-4/5 rounded bg-canvas" />
      <div className="mt-4 h-3 w-1/2 rounded bg-mist" />
    </div>
  );
}

export function DemandListPanel() {
  const { reload, ...state } = useDemandList();
  return <DemandListContent state={state} reload={reload} />;
}

export function DemandListContent({ state, reload }: { state: DemandListState; reload: () => void }) {
  const { phase, items, source, error } = state;
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<DemandStatusFilter>("all");
  const filteredItems = filterDemands(items, keyword, status);
  const clearFilters = () => {
    setKeyword("");
    setStatus("all");
  };

  return (
    <div>
      <PageHeader
        title="需求列表"
        subtitle="未登录时展示平台公开需求；登录后展示本人全部需求。点开任意一条可以看完整信息。"
        aside={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={reload} disabled={phase === "loading"}>
              {phase === "loading" ? "刷新中…" : "刷新列表"}
            </Button>
            <LinkButton href="/owner/demand/chat">发起新需求</LinkButton>
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone={source === "live" ? "brand" : source === "mock" ? "accent" : "neutral"}>
          列表接口来源：{source ?? "未确认"}
        </Badge>
        <span className={C.meta}>
          {phase === "ready" ? `${items.length} 条需求` : phase === "loading" ? "加载中" : "加载失败"}
        </span>
      </div>

      {phase === "ready" && (
        <Explainer summary="列表来源说明" className="!mt-0">
          <p>{listSourceNote(source)}</p>
        </Explainer>
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
          <Card className="mb-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)_auto] sm:items-end">
              <Field label="搜索需求">
                <input
                  className={C.input}
                  type="search"
                  placeholder="需求编号、城市或描述"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                />
              </Field>
              <Field label="需求状态">
                <select className={C.input} value={status} onChange={(event) => setStatus(event.target.value as DemandStatusFilter)}>
                  <option value="all">全部状态</option>
                  {STAGES.map((stage) => <option key={stage.status} value={stage.status}>{statusLabel(stage.status)}</option>)}
                </select>
              </Field>
              <Button variant="secondary" onClick={clearFilters} disabled={keyword === "" && status === "all"}>清空筛选</Button>
            </div>
            <p className={`!mb-0 mt-3 ${C.meta}`} role="status" aria-live="polite">
              显示 {filteredItems.length} / {items.length} 条需求；仅筛选当前已加载的数据。
            </p>
          </Card>
          {filteredItems.length === 0 ? (
            <Empty
              title="没有符合筛选条件的需求"
              hint="已加载的需求中没有匹配项，请调整关键词、状态或清空筛选。"
              action={<Button variant="secondary" size="sm" onClick={clearFilters}>查看全部已加载需求</Button>}
            />
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            {filteredItems.map((demand) => (
              <Card key={demand.id} className="flex flex-col gap-4">
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

                <p className="!mb-0 line-clamp-2 text-[15px] leading-relaxed text-ink-2">
                  {demand.description}
                </p>

                <FulfillmentRuler status={demand.status} compact />

                <dl className="num !mb-0 grid grid-cols-3 gap-3">
                  <div>
                    <dt className={C.meta}>预算</dt>
                    <dd className="!mb-0 text-[17px] font-semibold leading-snug text-ink">
                      {formatBudget(demand.budgetMinCents, demand.budgetMaxCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className={C.meta}>期望工期</dt>
                    <dd className="!mb-0 text-[17px] font-semibold leading-snug text-ink">
                      {demand.desiredDays} 天
                    </dd>
                  </div>
                  <div>
                    <dt className={C.meta}>面积</dt>
                    <dd className="!mb-0 text-[17px] font-semibold leading-snug text-ink">
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
