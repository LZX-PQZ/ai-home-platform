import { Money, QuoteSubmissionInput, type QuoteDTO } from "@/contracts";

/** 计价仅生成报价业务字段；不分配身份、ID、状态或成功信封，也不执行写入。 */
export function calculateQuoteSubmission(value: unknown): Pick<QuoteDTO, "demandId" | "estimatedDays" | "items" | "knownTotalCents" | "pendingItems"> {
  const input = QuoteSubmissionInput.parse(value);
  const items = input.items.map((item) => ({
    ...item,
    // 按 D 已冻结的规则逐行四舍五入到分；历史报价仍以已列明金额为准。
    amountCents: item.unitPriceCents === null ? null : Money.parse(Math.round(item.quantity * item.unitPriceCents)),
  }));
  let knownTotalCents = 0;
  for (const item of items) {
    if (item.amountCents !== null) knownTotalCents = Money.parse(knownTotalCents + item.amountCents);
  }
  return {
    demandId: input.demandId,
    estimatedDays: input.estimatedDays,
    items,
    knownTotalCents,
    // 同名但不同 code 的未知费用分别保留，不能按名称去重。
    pendingItems: items.filter((item) => item.amountCents === null).map((item) => item.name),
  };
}
