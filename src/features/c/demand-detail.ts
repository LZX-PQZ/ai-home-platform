import { Demand, DemandIdParams } from "@/contracts";
import { apiGet, ApiClientError } from "@/lib/api-client";
import { demandAccessFailure } from "./demand-access-recovery";

export async function loadDemandDetail(demandId: string) {
  const params = DemandIdParams.safeParse({ id: demandId });
  if (!params.success) throw new ApiClientError("需求编号无效。", "INVALID_DEMAND_ID", 400);
  const id = params.data.id;
  const response = await apiGet(`/api/demand/${encodeURIComponent(id)}`, Demand);
  if (response.data.id !== id) {
    throw new ApiClientError("需求详情编号与请求不一致。", "INVALID_RESPONSE", 200);
  }
  return {
    ...response,
    // 客户端隐藏不可报价详情，不代表接口已实施鉴权或数据隔离。
    data: response.data.status === "published" ? response.data : null,
  };
}

export type DemandDetailState =
  | { status: "loading" }
  | { status: "ready"; response: Awaited<ReturnType<typeof loadDemandDetail>> }
  | { status: "not-found" }
  | { status: "error"; message: string; canExitOwnerSession?: boolean };

export function demandDetailFailureState(error: unknown): Extract<DemandDetailState, { status: "not-found" | "error" }> {
  const access = demandAccessFailure(error);
  if (access) return { status: "error", ...access };
  if (error instanceof ApiClientError) {
    if (error.status === 404 && error.code === "DEMAND_NOT_FOUND") return { status: "not-found" };
    const messages: Partial<Record<number, string>> = {
      400: "需求编号无效，请返回需求大厅重新打开。",
      501: "需求接口尚未实现，暂时无法读取详情，请等待接口接入后重试。",
      503: "需求服务暂时不可用，请稍后重试。",
    };
    const message = messages[error.status];
    if (message) return { status: "error", message };
  }
  return { status: "error", message: "需求详情加载失败，请检查网络或稍后重试。" };
}
