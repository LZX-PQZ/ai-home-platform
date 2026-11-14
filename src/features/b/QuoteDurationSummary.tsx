import * as React from "react";
import type { DemandDTO, QuoteDTO } from "@/contracts";
import { compareQuoteDuration } from "@/lib/quote-engine/duration";

export function QuoteDurationSummary({ demand, quote }: { demand: DemandDTO; quote: QuoteDTO }) {
  const comparison = compareQuoteDuration(demand, quote);
  if (!comparison) return null;

  let message: string;
  switch (comparison.position) {
    case "longer": message = `报价预计工期比需求期望长 ${comparison.differenceDays} 天，请确认能否调整。`; break;
    case "shorter": message = `报价预计工期比需求期望短 ${comparison.differenceDays} 天。`; break;
    case "equal": message = "报价预计工期与需求期望天数相同。"; break;
    case "unavailable": message = "工期天数无法可靠比较，请核实需求和报价中的天数。"; break;
  }

  return (
    <section className="rounded-xl border border-line bg-canvas p-4" aria-label="与期望工期对照">
      <h4 className="text-sm font-semibold text-ink">与期望工期对照</h4>
      {comparison.position !== "unavailable" && <p className="mb-0 mt-2 text-xs text-ink-3">需求期望：{demand.desiredDays} 天 · 报价预计：{quote.estimatedDays} 天</p>}
      <p className={`mb-0 mt-2 text-sm ${comparison.position === "longer" ? "font-semibold text-amber-900" : "text-ink-2"}`}>{message}</p>
      <p className="mb-0 mt-2 text-xs text-ink-3">仅对照预计施工天数，不代表可立即开工、档期已确认或承诺按期完工；施工范围和起止日期仍需双方确认。</p>
    </section>
  );
}
