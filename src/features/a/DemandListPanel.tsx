"use client";

import Link from "next/link";
import { Badge, Button, C, Card, Empty, Note, PageHeader } from "./ui";
import {
  demandTitle,
  formatBudget,
  statusLabel,
  statusTone,
} from "./demand-list";
import { useDemandList } from "./useDemandList";

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

export function DemandListPanel() {
  const { phase, items, source, error, reload } = useDemandList();

  return (
    <div>
      <PageHeader
        title="我的装修"
        subtitle="一份需求单贯穿澄清、匹配、报价与施工；点开任意一条可以看完整信息。"
        aside={
          <Link href="/owner/demand/chat">
            <Button>发起新需求</Button>
          </Link>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone={source === "live" ? "brand" : "accent"}>
          列表接口来源：{source ?? "未确认"}
        </Badge>
        <span className={C.meta}>
          GET /api/demand · {phase === "ready" ? `${items.length} 条` : "加载中"}
        </span>
      </div>

      {phase === "loading" && (
        <div className="grid gap-3 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
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
          hint="先用一句话把房子的情况和想改的地方说清楚，AI 会帮您整理成结构化需求单"
          action={
            <Link href="/owner/demand/chat" className="mt-1">
              <Button size="sm">去发起需求</Button>
            </Link>
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
                    <h2 className={`!mb-1 ${C.sectionTitle}`}>{demandTitle(demand)}</h2>
                    <p className={`!mb-0 ${C.meta}`}>需求编号：{demand.id}</p>
                  </div>
                  <Badge tone={statusTone(demand.status)}>{statusLabel(demand.status)}</Badge>
                </div>

                <p className="!mb-0 line-clamp-2 text-[13px] leading-relaxed text-[#4A5A60]">
                  {demand.description}
                </p>

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
                  <Link href={`/owner/demand/${demand.id}`}>
                    <Button size="sm">查看需求详情</Button>
                  </Link>
                  <Link href={`/owner/matches/${demand.id}`}>
                    <Button variant="secondary" size="sm">
                      找服务方
                    </Button>
                  </Link>
                  <Link href={`/owner/quotes/${demand.id}`}>
                    <Button variant="ghost" size="sm">
                      看报价
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>

          <p className={`mt-4 !mb-0 ${C.meta}`}>
            说明：当前列表来自 mock 接口，只返回演示需求；真实需求需等 POST /api/demand 落库后才会出现在这里。
          </p>
        </>
      )}
    </div>
  );
}
