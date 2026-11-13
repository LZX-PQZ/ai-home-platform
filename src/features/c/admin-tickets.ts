import { Ticket } from "@/contracts";
import { apiGet, ApiClientError } from "@/lib/api-client";

// 字段类型直接从公共 Ticket Schema 推导，不维护另一套工单 DTO。
export const ticketCategoryLabels: Record<ReturnType<typeof Ticket.parse>["category"], string> = {
  quality: "质量问题",
  schedule: "工期问题",
  payment: "费用问题",
  attitude: "服务态度",
};
export const ticketStatusLabels: Record<ReturnType<typeof Ticket.parse>["status"], string> = {
  open: "待处理",
  assigned: "已分派",
  resolved: "已解决",
};

export async function loadAdminTickets() {
  const response = await apiGet("/api/ticket", Ticket.array());
  if (new Set(response.data.map((ticket) => ticket.id)).size !== response.data.length) {
    throw new ApiClientError("工单列表包含重复编号。", "INVALID_RESPONSE", 200);
  }
  return response;
}

export type AdminTicketsState =
  | { status: "loading" }
  | { status: "ready"; response: Awaited<ReturnType<typeof loadAdminTickets>> }
  | { status: "error"; message: string };

export function adminTicketsErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 401) return "请完成平台管理身份验证后重试。角色导航不能代替登录。";
    if (error.status === 403) return "当前身份无权查看售后工单。";
    if (error.status === 501) return "工单查询尚未实现，暂时无法展示列表。";
    if (error.status === 503) return "工单服务暂时不可用，请稍后重试。";
    if (error.code === "INVALID_RESPONSE") return "工单数据格式异常，请稍后重新加载。";
  }
  return "工单加载失败，请检查网络或稍后重试。";
}
