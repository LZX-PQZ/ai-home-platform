"use client";

import Link from "next/link";
import { Badge, Button, C, Card, DataDisclosure, Empty, LinkButton, Note, PageHeader, SectionHead } from "./ui";
import {
  demandTitle,
  formatBudget,
  isPostContract,
  paymentsHref,
  projectHref,
  statusLabel,
  statusTone,
} from "./demand-list";
import { detailMissingHint, detailViaLabel } from "./demand-detail";
import { itemSourceBadge } from "./demand-source";
import { renovationLabel } from "./demand-chat";
import { useDemandDetail } from "./useDemandDetail";

/**
 * 需求详情：首选 GET /api/demand/[id]；接口未开放时自动回退到列表按 ID 查找，
 * 并在页面上标注本次数据走的是哪条路径。查不到就如实说明，不用固定样例冒充这个 ID 的数据。
 */
export function DemandDetailPanel({ id }: { id: string }) {
  const { phase, demand, source, via, fallbackReason, error, reload } = useDemandDetail(id);

  if (phase === "loading") {
    return (
      <div>
        <PageHeader title="需求详情" subtitle={`正在读取需求 ${id}…`} />
        <DataDisclosure what="需求" />
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
        <DataDisclosure what="需求" />
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

  if (phase === "missing" || !demand) {
    return (
      <div>
        <PageHeader title="需求详情" subtitle="没有找到这条需求" />
        <DataDisclosure what="需求" />
        <Empty
          title={`接口未返回需求「${id}」`}
          hint={detailMissingHint(id, fallbackReason)}
          action={
            <LinkButton href="/owner" size="sm" variant="secondary">返回我的装修</LinkButton>
          }
        />
        {fallbackReason ? (
          <div className="mt-3">
            <Button variant="secondary" size="sm" onClick={() => void reload()}>
              重新读取
            </Button>
          </div>
        ) : null}
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
        subtitle={`需求编号 ${demand.id} · 来源 ${source ?? "未知"} · ${via ? detailViaLabel(via) : "未知路径"}`}
        aside={
          <span className="flex items-center gap-2">
            {itemSourceBadge(demand) ? <Badge tone="neutral">{itemSourceBadge(demand)}</Badge> : null}
            <Badge tone={statusTone(demand.status)}>{statusLabel(demand.status)}</Badge>
          </span>
        }
      />

      <DataDisclosure what="需求" />

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
              <LinkButton href={`/owner/matches/${encodeURIComponent(demand.id)}`} className="w-full">匹配服务方</LinkButton>
              <LinkButton href={`/owner/quotes/${encodeURIComponent(demand.id)}`} variant="secondary" className="w-full">查看报价对比</LinkButton>
              <LinkButton href="/owner/demand/chat" variant="ghost" className="w-full">继续补充需求</LinkButton>
            </div>
          </Card>

          <Card>
            <SectionHead
              title="施工与资金"
              aside={<Badge tone={isPostContract(demand.status) ? "brand" : "neutral"}>签约后</Badge>}
            />
            <p className={`!mb-3 ${C.meta}`}>
              排期由签约后的施工方提交，付款按节点走；两页都只读接口数据，不做本地假状态。
            </p>
            <div className="grid gap-2">
              <LinkButton href={projectHref(demand.id)} variant={isPostContract(demand.status) ? "primary" : "secondary"} className="w-full">查看施工进度</LinkButton>
              <LinkButton href={paymentsHref(demand.id)} variant="secondary" className="w-full">查看节点付款</LinkButton>
            </div>
            {!isPostContract(demand.status) ? (
              <div className="mt-3">
                <Note tone="info">
                  当前需求还在「{statusLabel(demand.status)}」阶段，排期与付款节点要等签约后才生成；
                  现在打开会看到「没有排期 / 没有付款节点」的如实提示，不会给你一份假计划。
                </Note>
              </div>
            ) : null}
          </Card>

          <Card>
            <SectionHead title="数据说明" />
            <Note tone="info">
              <p>
                来源：{source ?? "未知"}（{via ? detailViaLabel(via) : "未知路径"}）。字段严格按{" "}
                <code>src/contracts</code> 的 Demand 契约渲染，未经接口确认的信息不会出现在本页。
              </p>
              {fallbackReason ? (
                <p className="!mb-0 mt-2 text-[12.5px] text-[#7A6A2F]">
                  {fallbackReason}；按 ID 接口上线后本页会自动切换，无需改页面。
                </p>
              ) : null}
            </Note>
          </Card>
        </div>
      </div>
    </div>
  );
}
