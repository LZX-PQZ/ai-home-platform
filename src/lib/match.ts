import type { z } from "zod";
import { Match, type DemandDTO, type ProviderDTO } from "@/contracts";

export const renovationLabels: Record<DemandDTO["renovationType"], string> = {
  elderly: "适老化",
  partial: "局部改造",
  repair: "维修",
};

/** 城市和工种为硬条件；标签匹配 60 分，评分占 40 分。 */
export function matchProviders(
  demand: DemandDTO,
  candidates: ProviderDTO[],
): z.infer<typeof Match>[] {
  const city = demand.city.trim();
  const specialty = renovationLabels[demand.renovationType];
  if (!city) return [];

  return candidates
    .filter((provider) => provider.city.trim() === city && provider.kind === "construction")
    .map((provider) => {
      const hasSpecialty = provider.tags.some((tag) => tag.trim() === specialty);
      const ratingPoints = Math.round(provider.rating * 8);
      return {
        provider,
        score: (hasSpecialty ? 60 : 0) + ratingPoints,
        reasons: [
          `服务城市与需求一致：${city}`,
          "服务类型为施工团队",
          hasSpecialty
            ? `擅长标签包含「${specialty}」：+60 分`
            : `未标注「${specialty}」经验：+0 分，需进一步确认`,
          `评分 ${provider.rating}/5：+${ratingPoints} 分（评分 × 8，四舍五入）`,
        ],
      };
    })
    .sort((a, b) => {
      const difference = b.score - a.score;
      if (difference !== 0) return difference;
      // 同分时按稳定 ID 排序，避免候选数据顺序改变导致页面跳动。
      return a.provider.id < b.provider.id ? -1 : a.provider.id > b.provider.id ? 1 : 0;
    });
}
