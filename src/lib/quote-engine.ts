import type { QuoteDTO } from "@/contracts";
/** 只汇总已知费用；含未知项时不宣称最终总价。 */
export function summarizeQuote(quote:QuoteDTO) {
 return { knownTotalCents:quote.items.reduce((sum,item)=>sum+(item.amountCents??0),0),
 pendingItems:quote.items.filter(item=>item.amountCents===null).map(item=>item.name) };
}
