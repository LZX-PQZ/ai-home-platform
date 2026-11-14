"use client";

import { useEffect, useState } from "react";
import type { DemandDTO } from "@/contracts";
import { statusLabel } from "./demand-list";
import { loadTickets } from "./ticket-create";
import { Badge, Card, Note, SectionHead } from "./ui";

/**
 * 评价接口已经由 D 提供，但完工状态推进和业主侧接单信息读取尚未接通。
 * 在这两个前置条件完成前只展示门槛说明，不伪造服务方或提交成功状态。
 */
export function ReviewPanelContent({ demand }: { demand: DemandDTO }) {
  if (demand.status !== "completed") {
    return (
      <Card>
        <SectionHead title="服务评价" aside={<Badge tone="neutral">完成后开放</Badge>} />
        <Note tone="info">
          <p>需求完成后可评价。</p>
          <p>当前状态：{statusLabel(demand.status)}。完成状态由后续履约流程确认后，评价入口才会开放。</p>
        </Note>
      </Card>
    );
  }

  return (
    <Card>
      <SectionHead title="服务评价" aside={<Badge tone="neutral">暂未开放</Badge>} />
      <Note tone="info">
        <p>需求已完工，评价提交将在页面确认已完成接单服务方后开放。</p>
        <p>当前页面只展示状态说明，不会虚构评价对象或提交结果。</p>
      </Note>
    </Card>
  );
}

/**
 * 评价说明也属于本人需求视图。先复用工单列表的业主权限预检，
 * 匿名或其他业主打开公开需求时不泄露评价状态或入口。
 */
export function ReviewPanel({ demand }: { demand: DemandDTO }) {
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");

  useEffect(() => {
    let active = true;
    setAccess("checking");
    void loadTickets(demand.id)
      .then(() => { if (active) setAccess("allowed"); })
      .catch(() => { if (active) setAccess("denied"); });
    return () => { active = false; };
  }, [demand.id]);

  return access === "allowed" ? <ReviewPanelContent demand={demand} /> : null;
}
