import { Demand, envelope } from "@/contracts";
import type { DemandDTO } from "@/contracts";

/**
 * 详情页的数据来源路径。
 * - byId：命中 GET /api/demand/[id]（D 落地后的首选路径）
 * - list：按 ID 接口尚未开放或返回异常，回退到 GET /api/demand 列表里查找
 */
export type DetailVia = "byId" | "list";

export type DetailProbe =
  | { kind: "demand"; demand: DemandDTO; source: "mock" | "live" }
  | { kind: "fallback"; reason: string };

/** 按 ID 接口未开放时，给用户看的具体原因（不笼统写“加载失败”） */
export function detailFallbackReason(status: number): string {
  if (status === 404) return "按 ID 查询接口尚未开放（HTTP 404），已回退到列表查找";
  if (status === 501) return "按 ID 查询接口尚未实现（HTTP 501），已回退到列表查找";
  if (status >= 500) return `按 ID 查询接口暂时不可用（HTTP ${status}），已回退到列表查找`;
  if (status === 401 || status === 403) return `按 ID 查询没有权限（HTTP ${status}），已回退到列表查找`;
  return `按 ID 查询未成功（HTTP ${status}），已回退到列表查找`;
}

/**
 * 解释 GET /api/demand/[id] 的响应：
 * 只有 2xx 且 envelope 校验通过、且 id 与请求一致时才算命中；
 * 其余一律返回 fallback（附具体原因），由调用方决定是否回退到列表。
 * 这样接口上线前后页面都能工作，且不会把别的需求当成这一条。
 */
export function interpretDetailResponse(
  status: number,
  payload: unknown,
  requestedId: string,
): DetailProbe {
  if (status < 200 || status >= 300) return { kind: "fallback", reason: detailFallbackReason(status) };

  const parsed = envelope(Demand).safeParse(payload);
  if (!parsed.success) {
    return { kind: "fallback", reason: "按 ID 查询返回的数据不符合契约，已回退到列表查找" };
  }
  if (parsed.data.data.id !== requestedId) {
    return { kind: "fallback", reason: "按 ID 查询返回了另一条需求，已回退到列表查找" };
  }
  return { kind: "demand", demand: parsed.data.data, source: parsed.data.meta.source };
}

/** 数据路径的中文标签，显示在页面上，让人知道数据是怎么取到的 */
export function detailViaLabel(via: DetailVia): string {
  return via === "byId" ? "按 ID 查询" : "列表回退";
}

/** 找不到需求时给用户的原因说明，区分“接口没开”和“确实没有这条” */
export function detailMissingHint(id: string, fallbackReason: string | null): string {
  if (fallbackReason) {
    return `${fallbackReason}；列表里也没有编号为「${id}」的需求。本页不会用其他样例数据冒充这条需求。`;
  }
  return `接口未返回编号为「${id}」的需求。本页不会用其他样例数据冒充这条需求。`;
}
