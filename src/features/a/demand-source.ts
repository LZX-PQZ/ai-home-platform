/**
 * 逐条来源标识。
 *
 * 现状：GET /api/demand 只在 meta.source 上给整批数据一个来源（mock / live），
 * 一旦「演示需求」和「业主新建的真实需求」混在同一个列表里，整批标签就会误导。
 * 彻底的做法是每条数据自带来源，这里先按两种常见字段名接收（source / simulated），
 * D 在契约里补上任一种，页面就会自动逐条标注，A 侧无需再改。
 */
import { z } from "zod";
import { Demand } from "@/contracts";
import type { DemandDTO } from "@/contracts";

/** 在 Demand 契约之上容忍两个可选的逐条来源字段（z.object 默认会丢掉未知字段，所以必须显式声明） */
export const DemandWithSource = Demand.extend({
  source: z.enum(["mock", "live"]).optional(),
  simulated: z.boolean().optional(),
});

export type DemandWithSourceDTO = z.infer<typeof DemandWithSource>;

/** 单条需求的来源；接口没给就返回 null（页面不猜，由整批 source 兜底说明） */
export function itemSource(item: DemandDTO & { source?: "mock" | "live"; simulated?: boolean }): "mock" | "live" | null {
  if (item.source === "mock" || item.source === "live") return item.source;
  if (item.simulated === true) return "mock";
  return null;
}

/** 逐条徽标文案：只有确认为模拟时才提示，真实数据不加噪音 */
export function itemSourceBadge(
  item: DemandDTO & { source?: "mock" | "live"; simulated?: boolean },
): string | null {
  return itemSource(item) === "mock" ? "模拟数据" : null;
}

/** 列表整体说明：不再断言「只返回演示需求」，改为说明本次接口的来源与落库行为 */
export function listSourceNote(source: "mock" | "live" | null): string {
  if (source === "live") {
    return "说明：本次列表来自真实数据库（source: live），新建需求经 POST /api/demand 落库后会出现在这里。";
  }
  if (source === "mock") {
    return "说明：本次列表接口返回的是模拟数据（source: mock），页面不会在本地插入需求；实际是否已落库以接口返回为准。";
  }
  return "说明：列表来源未知，页面按接口原样展示，不猜测数据的真假。";
}
