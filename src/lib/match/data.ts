import { Match, envelope } from "@/contracts";
import { demoDemand, providers } from "@/lib/mock-data";
import { matchProviders } from "@/lib/match";

const MatchResponse = envelope(Match.array());

/** D 提供真实查询前，仅允许读取已知演示需求，禁止用演示数据冒充其他 ID。 */
export function loadMatchData(demandId = demoDemand.id) {
  if (demandId !== demoDemand.id) return null;
  return {
    demand: demoDemand,
    response: MatchResponse.parse({
      ok: true,
      data: matchProviders(demoDemand, providers),
      meta: { source: "mock" },
    }),
  };
}
