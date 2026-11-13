import { notImplemented } from "@/lib/api-response";
import { loadQuoteData } from "@/lib/quote-engine/data";

export function GET() {
  // 沿用现有无参数演示入口；真实查询参数协议待 D 确认。
  return Response.json(loadQuoteData()!.response);
}

export const POST = notImplemented;
