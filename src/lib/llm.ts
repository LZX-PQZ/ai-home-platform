import type { ChatInputDTO, ChatResultDTO } from "@/contracts";
/** D 负责真实模型接入。当前不会调用外部模型，不根据口述虚构完整需求单。 */
export async function clarifyDemand(input: ChatInputDTO): Promise<ChatResultDTO> {
 void input;
 if (process.env.AI_MODE === "live") throw new Error("真实模型适配尚未实现，请使用 mock 模式。");
 return { reply:"【模拟助手】请补充城市、面积、预算范围、改造类型和期望工期。",ready:false,draft:null,missingFields:["city","areaM2","budgetMinCents","budgetMaxCents","renovationType","desiredDays"] };
}
