import { loadQuoteData } from "@/lib/quote-engine/data";
import { handleQuoteSubmission } from "@/lib/quote-engine/submit-request";

export function GET() {
  // 沿用演示入口；D 已冻结读取协议，公共查询契约和业主授权适配器待交付。
  return Response.json(loadQuoteData()!.response);
}

export async function POST(request: Request) {
  // 演示会话在预检和事务内分别验证；首次提交及重放均标记 mock。
  return handleQuoteSubmission(request);
}
