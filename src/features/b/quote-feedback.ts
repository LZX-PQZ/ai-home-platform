import type { loadQuoteComparison } from "@/features/b/load-quotes";

/** 仅描述本次可展示的结果，不把读取完成说成提交成功或报价新增。 */
export function quoteReadFeedback(data: Awaited<ReturnType<typeof loadQuoteComparison>>): string {
  const count = data.response.data.length;
  if (data.quoteSource === "mock") {
    return count > 0
      ? `本次读取完成，展示 ${count} 份模拟报价；不代表真实报价已更新。`
      : "本次读取完成，暂无属于这份需求的模拟报价；不能据此判断是否存在真实报价。";
  }
  return count > 0
    ? `本次读取完成，展示 ${count} 份已提交或已接受的报价。`
    : "本次读取完成，暂无可对比的已提交或已接受报价。";
}
