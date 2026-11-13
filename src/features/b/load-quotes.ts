import { Demand, DemandIdParams, Provider, Quote, envelope } from "@/contracts";
import { apiGet, ApiClientError } from "@/lib/api-client";
import { prepareQuotes } from "@/lib/quote-engine";

export class QuoteDemandNotFound extends Error {
  constructor() {
    super("这份需求不存在，请返回需求列表选择已有需求。");
    this.name = "QuoteDemandNotFound";
  }
}

/** 仅使用已开放的读取协议；报价接口未支持需求参数，因此在此精确筛选。 */
export async function loadQuoteComparison(demandId: string) {
  const params = DemandIdParams.safeParse({ id: demandId });
  if (!params.success) throw new ApiClientError("需求 ID 无效。", "VALIDATION_ERROR", 400);

  const demand = await apiGet(`/api/demand/${encodeURIComponent(params.data.id)}`, Demand)
    .catch((error: unknown) => {
      if (error instanceof ApiClientError && error.status === 404 && error.code === "DEMAND_NOT_FOUND") {
        throw new QuoteDemandNotFound();
      }
      throw error;
    });
  if (demand.data.id !== demandId) {
    throw new ApiClientError("需求接口返回了其他需求。", "INVALID_RESPONSE", 200);
  }

  const quotes = await apiGet("/api/quote", Quote.array());
  const visible = prepareQuotes(demandId, quotes.data);
  // 没有报价时无需加载服务方，不让无关查询失败遮蔽已确认的空列表。
  const providers = visible.length ? await apiGet("/api/provider", Provider.array()) : null;
  const source = demand.meta.source === "live" && quotes.meta.source === "live" && (!providers || providers.meta.source === "live") ? "live" : "mock";

  return {
    demand: demand.data,
    providers: providers?.data ?? [],
    demandSource: demand.meta.source,
    quoteSource: quotes.meta.source,
    providerSource: providers?.meta.source ?? null,
    response: envelope(Quote.array()).parse({ ok: true, data: visible, meta: { source } }),
  };
}

export function quoteLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 501) return "所需接口尚未开放，暂时无法读取报价。";
    if (error.status === 503) return "数据服务暂时不可用，请稍后重试。";
    if (error.code === "NETWORK_ERROR") return "网络请求失败，请检查连接后重试。";
    if (error.code === "INVALID_RESPONSE") return "接口返回的数据不符合约定，暂时无法展示报价。";
  }
  return "报价数据加载失败，请稍后重试。";
}
