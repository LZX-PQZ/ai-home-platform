import { Id } from "@/contracts";
import { loadDemandHall } from "./demand-hall";

// 单条接口尚未由 D 提供：仅在公共列表返回的已发布需求中精确查找。
// 未找到只表示当前列表没有该记录，不能推断后台资源不存在或已授权访问。
export async function loadDemandDetail(demandId: string) {
  const id = Id.parse(demandId);
  const response = await loadDemandHall();
  return {
    ...response,
    data: response.data.find((demand) => demand.id === id) ?? null,
  };
}

export type DemandDetailState =
  | { status: "loading" }
  | { status: "ready"; response: Awaited<ReturnType<typeof loadDemandDetail>> }
  | { status: "error"; message: string };

export function demandDetailErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.includes("HTTP 501")) {
    return "需求接口尚未实现，暂时无法读取详情，请等待接口接入后重试。";
  }
  return "需求详情加载失败，请检查网络或稍后重试。";
}
