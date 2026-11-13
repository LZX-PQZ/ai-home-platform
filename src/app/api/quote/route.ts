import { loadQuoteData } from "@/lib/quote-engine/data";
import { handleQuoteSubmission } from "@/lib/quote-engine/submit-request";

export function GET() {
  // 沿用现有无参数演示入口；真实查询参数协议待 D 确认。
  return Response.json(loadQuoteData()!.response);
}

export async function POST(request: Request) {
  return handleQuoteSubmission(request);
}
