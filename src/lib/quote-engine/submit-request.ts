import { ZodError } from "zod";
import type { ApiFailure } from "@/contracts";
import { notImplemented } from "@/lib/api-response";
import { findDemand } from "@/lib/demand";
import { providerIdentityFailureResponse, requireProviderIdentity, type VerifiedSessionReader } from "@/lib/server-auth";
import { calculateQuoteSubmission } from "@/lib/quote-engine/submission";

/** readSession 只能由服务端注入已验证会话适配器，HTTP 路由不接受客户端指定它。 */
export async function handleQuoteSubmission(request: Request, readSession?: VerifiedSessionReader) {
  const identity = await requireProviderIdentity(request, readSession);
  if (!identity.ok) return providerIdentityFailureResponse(identity);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ ok: false, error: { code: "INVALID_JSON", message: "请求不是有效 JSON。" } } satisfies ApiFailure, { status: 400 });
  }
  let submission: ReturnType<typeof calculateQuoteSubmission>;
  try {
    submission = calculateQuoteSubmission(input);
  } catch (error) {
    if (!(error instanceof ZodError)) throw error;
    return Response.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "报价字段不符合契约，或计算金额超出安全范围。" } } satisfies ApiFailure, { status: 400 });
  }

  try {
    const demand = await findDemand(submission.demandId);
    if (!demand) {
      return Response.json({ ok: false, error: { code: "DEMAND_NOT_FOUND", message: "这份需求不存在。" } } satisfies ApiFailure, { status: 404 });
    }
    if (demand.data.id !== submission.demandId) throw new Error("需求查询返回了其他 ID。");
    if (demand.data.status !== "published") {
      return Response.json({ ok: false, error: { code: "INVALID_STATE", message: "只有已发布且未签约的需求可以提交报价。" } } satisfies ApiFailure, { status: 409 });
    }
  } catch {
    return Response.json({ ok: false, error: { code: "DATABASE_UNAVAILABLE", message: "需求数据暂时无法读取，请稍后重试。" } } satisfies ApiFailure, { status: 503 });
  }

  // 身份与需求状态通过仍不等于报价成功；细粒度授权、幂等及原子写入尚未接通。
  return notImplemented();
}
