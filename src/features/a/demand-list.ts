/**
 * 需求列表/详情的纯逻辑：状态文案、金额格式化、按 ID 查找。
 * 不涉及 React 与网络，便于单测；页面只做展示。
 */
import type { DemandDTO } from "@/contracts";
import { renovationLabel } from "./demand-chat";

export type StatusTone = "brand" | "accent" | "neutral" | "danger";

/** 契约里的 status 是英文枚举，页面上一律显示中文 */
export const STATUS_LABELS: Record<DemandDTO["status"], { label: string; tone: StatusTone }> = {
  draft: { label: "草稿", tone: "neutral" },
  published: { label: "已发布 · 待匹配", tone: "accent" },
  contracted: { label: "已签约", tone: "brand" },
  in_progress: { label: "施工中", tone: "brand" },
  completed: { label: "已完工", tone: "neutral" },
};

export function statusLabel(status: DemandDTO["status"]): string {
  return STATUS_LABELS[status]?.label ?? status;
}

export function statusTone(status: DemandDTO["status"]): StatusTone {
  return STATUS_LABELS[status]?.tone ?? "neutral";
}

/** 分 → 「¥30,000」；负值与非整数一律按 0 处理，避免显示奇怪的数字 */
export function formatYuan(cents: number): string {
  if (!Number.isFinite(cents) || cents < 0) return "¥0";
  return "¥" + Math.round(cents / 100).toLocaleString("zh-CN");
}

/** 预算区间：上下限相同就只显示一个数 */
export function formatBudget(minCents: number, maxCents: number): string {
  if (minCents === maxCents) return formatYuan(minCents);
  return `${formatYuan(minCents)} – ${formatYuan(maxCents)}`;
}

/** 列表标题：契约里没有标题字段，用「城市 · 面积 · 改造类型」拼，避免出现无名卡片 */
export function demandTitle(demand: DemandDTO): string {
  return `${demand.city} · ${demand.areaM2}㎡ · ${renovationLabel(demand.renovationType)}`;
}

/** 按 ID 在列表里找需求；找不到返回 null，调用方必须如实提示而不是编数据 */
export function findDemand(list: DemandDTO[], id: string): DemandDTO | null {
  return list.find((item) => item.id === id) ?? null;
}
