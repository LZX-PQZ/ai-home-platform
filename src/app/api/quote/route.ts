import { loadQuoteData } from "@/lib/quote-engine/data";
import { handleQuoteSubmission } from "@/lib/quote-engine/submit-request";

export function GET() {
  // 沿用现有无参数演示入口；真实查询参数协议待 D 确认。
  return Response.json(loadQuoteData()!.response);
}

export async function POST(request: Request) {
  // handler 已连接事务内核；D 的默认会话读取器仍为空，实际未登录请求先返回 401。
  return handleQuoteSubmission(request);
}
