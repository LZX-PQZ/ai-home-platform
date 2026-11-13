import { Demand, type DemandDTO, type DemandStatus } from "@/contracts";
import { apiGet, ApiClientError } from "@/lib/api-client";

export const adminDemandStatuses = Demand.shape.status.options;
export const adminDemandStatusLabels: Record<DemandStatus, string> = {
  draft: "草稿",
  published: "已发布",
  contracted: "已签约",
  in_progress: "施工中",
  completed: "已完成",
};

export async function loadAdminDemands() {
  const response = await apiGet("/api/demand", Demand.array());
  if (new Set(response.data.map((demand) => demand.id)).size !== response.data.length) {
    throw new ApiClientError("需求列表包含重复编号。", "INVALID_RESPONSE", 200);
  }
  return response;
}

export function summarizeAdminDemands(demands: readonly DemandDTO[]) {
  const byStatus: Record<DemandStatus, number> = {
    draft: 0, published: 0, contracted: 0, in_progress: 0, completed: 0,
  };
  for (const demand of demands) byStatus[demand.status] += 1;
  return { total: demands.length, byStatus };
}

export type AdminDemandState =
  | { status: "loading" }
  | { status: "ready"; response: Awaited<ReturnType<typeof loadAdminDemands>> }
  | { status: "error"; message: string };

export function adminDemandErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 401) return "请完成平台管理身份验证后重试。角色导航不能代替登录。";
    if (error.status === 403) return "当前身份无权查看需求概览。";
    if (error.status === 501) return "需求查询尚未实现，暂时无法展示概览。";
    if (error.status === 503) return "需求服务暂时不可用，请稍后重试。";
  }
  return "需求概览加载失败，请检查网络或稍后重试。";
}
