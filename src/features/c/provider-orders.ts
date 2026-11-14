import { Quote, type QuoteDTO } from "@/contracts";
import { apiGet, ApiClientError } from "@/lib/api-client";

export const providerOrderStatusLabels: Record<QuoteDTO["status"], string> = {
  draft: "草稿报价",
  submitted: "待业主确认",
  accepted: "已确认承接",
  rejected: "已拒绝",
};

export async function loadProviderOrders() {
  const response = await apiGet("/api/quote", Quote.array());
  if (new Set(response.data.map((quote) => quote.id)).size !== response.data.length) {
    throw new ApiClientError("报价列表包含重复编号。", "INVALID_RESPONSE", 200);
  }
  return response;
}

export function summarizeProviderOrders(quotes: readonly QuoteDTO[]) {
  return quotes.reduce(
    (summary, quote) => {
      if (quote.status === "accepted") summary.accepted += 1;
      if (quote.status === "submitted") summary.submitted += 1;
      return summary;
    },
    { accepted: 0, submitted: 0 },
  );
}

export type ProviderOrdersState =
  | { status: "loading" }
  | { status: "ready"; response: Awaited<ReturnType<typeof loadProviderOrders>> }
  | { status: "error"; message: string };

export function providerOrdersErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 401) return "请完成服务方身份验证后重试。角色导航不能代替登录。";
    if (error.status === 403) return "当前身份无权查看接单记录。";
    if (error.status === 501) return "接单查询尚未实现，暂时无法展示记录。";
    if (error.status === 503) return "接单服务暂时不可用，请稍后重试。";
    if (error.code === "INVALID_RESPONSE") return "接单数据格式异常，请稍后重新加载。";
  }
  return "接单记录加载失败，请检查网络或稍后重试。";
}
