import { Match, envelope } from "@/contracts";
import { findDemand } from "@/lib/demand";
import { demoDemand, providers } from "@/lib/mock-data";
import { matchProviders } from "@/lib/match";

const MatchResponse = envelope(Match.array());

/** 无参数保留固定演示入口；显式 ID 必须通过 D 的需求查询，不允许回退。 */
export async function loadMatchData(demandId?: string) {
  const result = demandId === undefined ? { data: demoDemand } : await findDemand(demandId);
  if (!result) return null;
  if (demandId !== undefined && result.data.id !== demandId) {
    throw new Error("需求查询返回的 ID 与请求不一致。");
  }
  return {
    demand: result.data,
    response: MatchResponse.parse({
      ok: true,
      data: matchProviders(result.data, providers),
      // 需求可以来自数据库，但候选团队仍是固定模拟资料，整体不能标 live。
      meta: { source: "mock" },
    }),
  };
}
