import { Demand, DemandIdParams, Match, Provider, envelope } from "@/contracts";
import { apiGet, ApiClientError } from "@/lib/api-client";
import { matchProviders } from "@/lib/match";

export class MatchDemandNotFound extends Error {
  constructor() {
    super("这份需求不存在，请返回需求列表选择已有需求。");
    this.name = "MatchDemandNotFound";
  }
}

/** 浏览器通过 D 已开放的接口读数据；任何失败都不回退到固定需求。 */
export async function loadMatches(demandId: string) {
  const params = DemandIdParams.safeParse({ id: demandId });
  if (!params.success) throw new ApiClientError("需求 ID 无效。", "VALIDATION_ERROR", 400);

  const demandResponse = await apiGet(`/api/demand/${encodeURIComponent(params.data.id)}`, Demand)
    .catch((error: unknown) => {
      if (error instanceof ApiClientError && error.status === 404 && error.code === "DEMAND_NOT_FOUND") {
        throw new MatchDemandNotFound();
      }
      throw error;
    });
  if (demandResponse.data.id !== demandId) {
    throw new ApiClientError("需求接口返回了其他需求，无法展示匹配结果。", "INVALID_RESPONSE", 200);
  }

  const providerResponse = await apiGet("/api/provider", Provider.array());
  const demandSource = demandResponse.meta.source;
  const providerSource = providerResponse.meta.source;
  return {
    demand: demandResponse.data,
    demandSource,
    providerSource,
    response: envelope(Match.array()).parse({
      ok: true,
      data: matchProviders(demandResponse.data, providerResponse.data),
      meta: { source: demandSource === "live" && providerSource === "live" ? "live" : "mock" },
    }),
  };
}

export function matchLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 501) return "所需接口尚未开放，暂时无法生成匹配结果。";
    if (error.status === 503) return "数据服务暂时不可用，请稍后重试。";
    if (error.code === "NETWORK_ERROR") return "网络请求失败，请检查连接后重试。";
    if (error.code === "INVALID_RESPONSE") return "接口返回的数据不符合约定，暂时无法展示匹配结果。";
  }
  return "匹配数据加载失败，请稍后重试。";
}
