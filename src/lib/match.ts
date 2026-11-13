import type { DemandDTO, ProviderDTO } from "@/contracts";
/** B 的规则基线；优先过滤城市，后续补预算/可用日期等真实字段与校验。 */
export function matchProviders(demand:DemandDTO, candidates:ProviderDTO[]) {
 return candidates.filter(p=>p.city===demand.city && p.kind==="construction")
 .map(provider=>({provider,score:Math.round(provider.rating*20),reasons:["服务城市匹配","演示排序基于样例评分；尚未验证档期"]}))
 .sort((a,b)=>b.score-a.score);
}
