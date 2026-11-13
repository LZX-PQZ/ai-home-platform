import { Demand } from "@/contracts";
import { apiGet } from "@/lib/api-client";

export async function loadDemandHall() {
  const response = await apiGet("/api/demand", Demand.array());
  return {
    ...response,
    data: response.data.filter((demand) => demand.status === "published"),
  };
}

export type DemandHallState =
  | { status: "loading" }
  | { status: "ready"; response: Awaited<ReturnType<typeof loadDemandHall>> }
  | { status: "error"; message: string };

const currency = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatBudget(cents: number) {
  return currency.format(cents / 100);
}

export function demandHallErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.includes("HTTP 501")) {
    return "需求接口尚未实现，暂时无法读取需求，请等待接口接入后重试。";
  }
  return "需求列表加载失败，请检查网络或稍后重试。";
}
