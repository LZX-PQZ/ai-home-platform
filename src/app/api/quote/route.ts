import { handleQuoteRead } from "@/lib/quote-engine/read-request";
import { handleQuoteSubmission } from "@/lib/quote-engine/submit-request";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleQuoteRead(request);
}

export async function POST(request: Request) {
  // 演示会话在预检和事务内分别验证；首次提交及重放均标记 mock。
  return handleQuoteSubmission(request);
}
