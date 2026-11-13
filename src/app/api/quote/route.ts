import { ZodError } from "zod";
import type { ApiFailure } from "@/contracts";
import { notImplemented } from "@/lib/api-response";
import { loadQuoteData } from "@/lib/quote-engine/data";
import { calculateQuoteSubmission } from "@/lib/quote-engine/submission";

export function GET() {
  // 沿用现有无参数演示入口；真实查询参数协议待 D 确认。
  return Response.json(loadQuoteData()!.response);
}

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ ok: false, error: { code: "INVALID_JSON", message: "请求不是有效 JSON。" } } satisfies ApiFailure, { status: 400 });
  }
  try {
    calculateQuoteSubmission(input);
  } catch (error) {
    if (!(error instanceof ZodError)) throw error;
    return Response.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "报价字段不符合契约，或计算金额超出安全范围。" } } satisfies ApiFailure, { status: 400 });
  }
  // 校验与计价通过不等于提交成功；身份、需求权限和原子写入接通后才能返回报价。
  return notImplemented();
}
