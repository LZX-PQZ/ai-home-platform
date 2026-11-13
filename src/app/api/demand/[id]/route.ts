import { Id } from "@/contracts";
import { dataResponse } from "@/lib/api-response";
import { findDemand } from "@/lib/demand";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const parsedId = Id.safeParse(params.id.trim());
  if (!parsedId.success) {
    return Response.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "需求 ID 不能为空。" } }, { status: 400 });
  }
  try {
    const result = await findDemand(parsedId.data);
    if (!result) {
      return Response.json({ ok: false, error: { code: "DEMAND_NOT_FOUND", message: "需求不存在。" } }, { status: 404 });
    }
    return dataResponse(result.data, result.source);
  } catch {
    return Response.json(
      { ok: false, error: { code: "DATABASE_UNAVAILABLE", message: "需求数据暂时无法读取。" } },
      { status: 503 },
    );
  }
}
