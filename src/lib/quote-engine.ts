import { Money, Quote, type DemandDTO, type QuoteDTO } from "@/contracts";

/** 只汇总明细中已列明的金额；未知项和额外待确认费用必须保留。 */
export function summarizeQuote(quote: QuoteDTO): Pick<QuoteDTO, "knownTotalCents" | "pendingItems"> {
  let knownTotalCents = 0;
  const pendingItems = new Set(quote.pendingItems);

  for (const item of quote.items) {
    if (item.amountCents !== null) {
      // 单项和累计值都必须是安全整数，避免溢出后展示错误金额。
      knownTotalCents = Money.parse(knownTotalCents + Money.parse(item.amountCents));
    }
    if (item.amountCents === null || item.unitPriceCents === null) {
      pendingItems.add(item.name);
    }
  }
  return { knownTotalCents, pendingItems: [...pendingItems] };
}

/** 业主当前对比只包含同一需求已提交或已接受的报价，不信任缓存合计。 */
export function prepareQuotes(demandId: DemandDTO["id"], candidates: QuoteDTO[]): QuoteDTO[] {
  return candidates
    .filter((quote) => quote.demandId === demandId && (quote.status === "submitted" || quote.status === "accepted"))
    .map((quote) => Quote.parse({ ...quote, ...summarizeQuote(quote) }));
}
