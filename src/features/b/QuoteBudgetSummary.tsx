import * as React from "react";
import type { DemandDTO, QuoteDTO } from "@/contracts";
import { formatQuoteMoney } from "@/features/b/format-quote";
import { compareQuoteBudget } from "@/lib/quote-engine/budget";

export function QuoteBudgetSummary({ demand, quote }: { demand: DemandDTO; quote: QuoteDTO }) {
  const comparison = compareQuoteBudget(demand, quote);
  if (!comparison) return null;

  let message: string;
  switch (comparison.position) {
    case "no-details": message = "尚未提供明细，暂不能与预算比较。"; break;
    case "unpriced": message = "尚无已列明金额，暂不能与预算比较。"; break;
    case "above": message = `已知小计已超过预算上限 ${formatQuoteMoney(comparison.differenceCents)}。`; break;
    case "at-limit": message = "已知小计已达到预算上限。"; break;
    case "below": message = `已知小计低于预算下限 ${formatQuoteMoney(comparison.differenceCents)}。`; break;
    case "within": message = `已知小计处于预算区间，距预算上限 ${formatQuoteMoney(comparison.differenceCents)}。`; break;
  }

  return (
    <section className="rounded-xl border border-line bg-canvas p-4" aria-label="与需求预算对照">
      <h4 className="text-sm font-semibold text-ink">与需求预算对照</h4>
      <p className="mb-0 mt-2 text-xs text-ink-3">需求预算：{formatQuoteMoney(demand.budgetMinCents)} – {formatQuoteMoney(demand.budgetMaxCents)}</p>
      <p className={`mb-0 mt-2 text-sm ${comparison.position === "above" ? "font-semibold text-amber-900" : "text-ink-2"}`}>{message}</p>
      {comparison.hasPending && <p className="mb-0 mt-2 text-xs text-amber-900">仍有待确认费用，最终金额尚不能确定。</p>}
      <p className="mb-0 mt-2 text-xs text-ink-3">仅对比已列明金额，差额不是可用余额，也不代表最终总价更低；实际范围及增项仍需确认。</p>
    </section>
  );
}
