"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button, C, Card, Empty, LinkButton, Note, PageHeader, SectionHead } from "./ui";
import { formatYuan } from "./demand-list";
import {
  detectPaymentIssues,
  paymentSummary,
  toPaymentNodes,
} from "./payments";
import { usePayments } from "./usePayments";

/**
 * 业主端「节点付款」页。
 *
 * 定位：让业主在开工前就看到「一共多少钱、按什么节点付、每笔占多少」，
 * 这是「预结算透明、不玩增项」的可见部分。
 *
 * 边界：不接真实支付、不做资金托管，所有节点都带 simulated 标记；
 * 页面不会出现「已支付」这种没有接口支撑的字样。
 */
export function PaymentsPanel({ id }: { id: string }) {
  const { phase, items, source, error, reload } = usePayments();
  const [actionNote, setActionNote] = useState<string | null>(null);

  if (phase === "loading") {
    return (
      <div>
        <PageHeader title="节点付款" subtitle={`正在读取需求 ${id} 的付款计划…`} />
        <Card className="animate-pulse">
          <div className="mb-4 h-4 w-1/3 rounded bg-[#EDF2F3]" />
          <div className="grid gap-3">
            {[0, 1].map((row) => (
              <div key={row} className="h-16 w-full rounded bg-[#F4F7F8]" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div>
        <PageHeader title="节点付款" subtitle="读取付款计划失败" />
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

  if (items.length === 0) {
    return (
      <div>
        <PageHeader title="节点付款" subtitle="这条需求还没有付款计划" />
        <Empty
          title="接口没有返回付款节点"
          hint="付款计划在签约后由合同生成（GET /api/payment 目前返回演示数据）。本页不会自己编一套节点出来。"
          action={
            <LinkButton href={`/owner/demand/${id}`} size="sm" variant="secondary">返回需求详情</LinkButton>
          }
        />
      </div>
    );
  }

  const summary = paymentSummary(items);
  const nodes = toPaymentNodes(items);
  const issues = detectPaymentIssues(items);
  const mismatch = items.some((item) => item.demandId !== id);
  const allSimulated = items.every((item) => item.simulated);

  return (
    <div>
      <div className="mb-3">
        <Link href={`/owner/project/${id}`} className="text-[13px] font-medium text-[#0F6E56]">
          ← 返回施工进度
        </Link>
      </div>

      <PageHeader
        title="节点付款"
        subtitle={`需求 ${id} · ${summary.count} 个节点 · 数据来源 ${source ?? "未知"}`}
        aside={allSimulated ? <Badge tone="accent">全部为模拟数据</Badge> : null}
      />

      {mismatch ? (
        <div className="mb-4">
          <Note tone="warn" title="返回数据与当前需求不一致">
            <p>
              接口返回的节点里含有不属于需求 <code>{id}</code> 的记录。按需求查询付款计划的接口由 D
              负责，尚未实现，本页照实展示并提示，不做静默过滤。
            </p>
          </Note>
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "计划付款总额", value: formatYuan(summary.totalCents), hint: "各节点金额之和" },
          {
            label: "已确认金额",
            value: formatYuan(summary.confirmedCents),
            hint: `${summary.confirmedCount} 个节点（演示确认）`,
          },
          {
            label: "待确认金额",
            value: formatYuan(summary.pendingCents),
            hint: `${summary.pendingCount} 个节点`,
          },
          {
            label: "确认进度",
            value: `${summary.confirmedPercent}%`,
            hint: "已确认金额 / 计划总额",
          },
        ].map((item) => (
          <Card key={item.label} className="!p-4">
            <div className={C.meta}>{item.label}</div>
            <div className="mt-1 text-[20px] font-bold tabular-nums tracking-tight text-[#16242B]">
              {item.value}
            </div>
            <div className="mt-0.5 truncate text-[11.5px] text-[#7A8A90]" title={item.hint}>
              {item.hint}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Card>
          <SectionHead
            title="付款节点"
            aside={<span className={C.meta}>按接口返回顺序</span>}
          />
          <ol className="relative grid gap-3 pl-6">
            <span className="absolute bottom-3 left-[7px] top-3 w-px bg-[#E2E9EB]" aria-hidden />
            {nodes.map((node) => (
              <li key={node.id} className="relative">
                <span
                  className={`absolute -left-6 top-3 h-[15px] w-[15px] rounded-full border-2 border-white ${
                    node.tone === "brand" ? "bg-[#0F6E56]" : "bg-[#E8A23C]"
                  }`}
                  aria-hidden
                />
                <div className="rounded-[10px] border border-[#EEF3F4] bg-[#FCFDFD] px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13.5px] font-medium text-[#16242B]">
                      节点 {node.index} · {node.stage}
                    </span>
                    <Badge tone={node.tone}>{node.statusLabel}</Badge>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[17px] font-semibold tabular-nums text-[#16242B]">
                      {formatYuan(node.amountCents)}
                    </span>
                    <span className="text-[11.5px] text-[#7A8A90]">
                      占总额 {node.sharePercent}%
                      {node.simulated ? " · 模拟节点" : ""}
                    </span>
                  </div>
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#EDF2F3]">
                    <div
                      className="h-full rounded-full bg-[#0F6E56]/70"
                      style={{ width: `${Math.min(100, node.sharePercent)}%` }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <SectionHead
              title="付款计划自检"
              aside={
                <Badge tone={issues.length > 0 ? "danger" : "brand"}>
                  {issues.length > 0 ? `${issues.length} 个问题` : "通过"}
                </Badge>
              }
            />
            {issues.length === 0 ? (
              <Note tone="ok">
                <p className="!mb-0">
                  节点名称不重复、金额有效、未混入其他需求 —— 业主能逐条对上「哪一步付多少」。
                </p>
              </Note>
            ) : (
              <ul className="grid gap-2">
                {issues.map((issue) => (
                  <li key={issue.code}>
                    <Note tone="warn">
                      <p className="!mb-0">{issue.message}</p>
                    </Note>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionHead title="操作" />
            <p className={`!mb-3 ${C.meta}`}>
              确认付款、上传凭证都需要写回后端（POST /api/payment），该接口目前返回 501；本页只读。
            </p>
            <div className="grid gap-2">
              <Button
                className="w-full"
                onClick={() =>
                  setActionNote(
                    "确认付款需要 POST /api/payment，接口尚未实现（501）。本页不会在本地把状态改成「已付款」——那会误导业主以为钱已经付了。",
                  )
                }
              >
                确认本节点
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() =>
                  setActionNote(
                    "上传凭证需要文件存储与 POST /api/payment，均未实现；字段缺口已写进 docs/requests/A-schedule-payment.md。",
                  )
                }
              >
                上传付款凭证
              </Button>
            </div>
            {actionNote ? (
              <div className="mt-3">
                <Note tone="info">{actionNote}</Note>
              </div>
            ) : null}
          </Card>

          <Card>
            <SectionHead title="关于资金安全" />
            <Note tone="warn" title="当前为演示数据">
              <p className="!mb-0">
                本页不接支付通道、不做资金托管，所有节点 <code>simulated</code> 均为 true。
                真实上线前必须接入持牌资金托管账户，且「已确认」只代表业主看过单据，不代表平台代收款项。
              </p>
            </Note>
          </Card>
        </div>
      </div>
    </div>
  );
}
