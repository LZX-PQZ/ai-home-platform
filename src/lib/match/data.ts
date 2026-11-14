import { Match, envelope } from "@/contracts";
import { findDemand } from "@/lib/demand";
import { demoDemand } from "@/lib/mock-data";
import { readProviderDirectory } from "@/lib/provider-directory";
import { matchProviders } from "@/lib/match";

const MatchResponse = envelope(Match.array());

/** 无参数保留固定演示入口；显式 ID 必须通过 D 的需求查询，不允许回退。 */
export async function loadMatchData(demandId?: string) {
  const result = demandId === undefined ? { data: demoDemand } : await findDemand(demandId);
  if (!result) return null;
  if (demandId !== undefined && result.data.id !== demandId) {
    throw new Error("需求查询返回的 ID 与请求不一致。");
  }
  // 与浏览器 GET /api/provider 的缺省口径一致；没有 live 样本不改用 mock。
  const directory = await readProviderDirectory();
  return {
    demand: result.data,
    response: MatchResponse.parse({
      ok: true,
      data: matchProviders(result.data, directory.data),
      meta: { source: result.data.source === "live" && directory.meta.source === "live" ? "live" : "mock" },
    }),
  };
}
