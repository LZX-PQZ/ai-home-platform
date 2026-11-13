import type { ApiFailure } from "@/contracts";
import { PhotoInspectionInput } from "@/contracts";
import { notImplemented } from "@/lib/api-response";

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({
      ok: false,
      error: { code: "INVALID_JSON", message: "请求不是有效 JSON。" },
    } satisfies ApiFailure, { status: 400 });
  }

  const parsed = PhotoInspectionInput.safeParse(input);
  if (!parsed.success) {
    return Response.json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "照片检查字段不符合契约。" },
    } satisfies ApiFailure, { status: 400 });
  }

  // 输入契约已开放；真实图片分析、来源和人工复核流程接通前仍明确返回 501。
  return notImplemented();
}
