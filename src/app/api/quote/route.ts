import { handleQuoteRead } from "@/lib/quote-engine/read-request";
import { handleQuoteSubmission } from "@/lib/quote-engine/submit-request";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleQuoteRead(request);
}

export async function POST(request: Request) {
  // handler 已连接事务内核；D 的默认会话读取器仍为空，实际未登录请求先返回 401。
  return handleQuoteSubmission(request);
}
