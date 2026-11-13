"use client";

import Link from "next/link";
import { Badge, Button, C, Card, Empty, Note, PageHeader, SectionHead } from "./ui";
import { demandTitle, findDemand, formatBudget, statusLabel, statusTone } from "./demand-list";
import { renovationLabel } from "./demand-chat";
import { useDemandList } from "./useDemandList";

/**
 * 需求详情：详情数据仍从 GET /api/demand 列表里按 ID 查（D 尚未提供 /api/demand/[id]）。
 * 查不到就如实说明，不用固定样例冒充这个 ID 的数据。
 */
export function DemandDetailPanel({ id }: { id: string }) {
  const { phase, items, source, error, reload } = useDemandList();
  const demand = phase === "ready" ? findDemand(items, id) : null;

  if (phase === "loading") {
    return (
      <div>
        <PageHeader title="需求详情" subtitle={`正在读取需求 ${id}…`} />
        <Card className="animate-pulse">
          <div className="mb-3 h-4 w-1/2 rounded bg-[#EDF2F3]" />
          <div className="mb-2 h-3 w-full rounded bg-[#F4F7F8]" />
          <div className="h-3 w-3/4 rounded bg-[#F4F7F8]" />
        </Card>
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div>
        <PageHeader title="需求详情" subtitle="读取需求失败" />
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

  if (!demand) {
    return (
      <div>
        <PageHeader title="需求详情" subtitle="没有找到这条需求" />
        <Empty
          title={`接口未返回需求「${id}」`}
          hint="GET /api/demand 当前只返回演示需求；按 ID 查询的接口由 D 负责，尚未实现。本页不会用其他样例数据冒充这条需求。"
          action={
            <Link href="/owner" className="mt-1">
              <Button size="sm" variant="secondary">
                返回我的装修
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3">
        <Link href="/owner" className="text-[13px] font-medium text-[#0F6E56]">
          ← 返回我的装修
        </Link>
      </div>

      <PageHeader
        title={demandTitle(demand)}
        subtitle={`需求编号 ${demand.id} · 来源 ${source ?? "未知"}`}
        aside={<Badge tone={statusTone(demand.status)}>{statusLabel(demand.status)}</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card>
          <SectionHead title="需求描述" />
          <p className="!mb-0 text-[13.5px] leading-relaxed text-[#16242B]">{demand.description}</p>

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[#EEF3F4] pt-4">
            {[
              ["城市", demand.city],
              ["面积", `${demand.areaM2} ㎡`],
              ["改造类型", renovationLabel(demand.renovationType)],
              ["期望工期", `${demand.desiredDays} 天`],
              ["预算区间", formatBudget(demand.budgetMinCents, demand.budgetMaxCents)],
              ["当前状态", statusLabel(demand.status)],
            ].map(([label, value]) => (
              <div key={label}>
                <div className={C.meta}>{label}</div>
                <div className="text-[13.5px] font-medium text-[#16242B]">{value}</div>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <SectionHead title="下一步" aside={<Badge tone="accent">推荐</Badge>} />
            <p className={`!mb-3 ${C.meta}`}>
              需求已结构化，接着去找匹配的服务方；这两页由 B 负责，用同一个需求 ID 打开。
            </p>
            <div className="grid gap-2">
              <Link href={`/owner/matches/${demand.id}`}>
                <Button className="w-full">匹配服务方</Button>
              </Link>
              <Link href={`/owner/quotes/${demand.id}`}>
                <Button variant="secondary" className="w-full">
                  查看报价对比
                </Button>
              </Link>
              <Link href="/owner/demand/chat">
                <Button variant="ghost" className="w-full">
                  继续补充需求
                </Button>
              </Link>
            </div>
          </Card>

          <Card>
            <SectionHead title="数据说明" />
            <Note tone="info">
              <p>
                来源：{source ?? "未知"}。字段严格按 <code>src/contracts</code> 的 Demand 契约渲染，
                未经接口确认的信息不会出现在本页。
              </p>
            </Note>
          </Card>
        </div>
      </div>
    </div>
  );
}
