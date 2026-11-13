import { DemandIdParams, type ApiFailure } from "@/contracts";
import { loadMatchData } from "@/lib/match/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ids = new URL(request.url).searchParams.getAll("demandId");
  if (ids.length > 1 || (ids.length === 1 && !DemandIdParams.safeParse({ id: ids[0] }).success)) {
    return Response.json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "请提供一个非空的需求 ID。" },
    } satisfies ApiFailure, { status: 400 });
  }
  try {
    const result = await loadMatchData(ids[0]);
    if (!result) {
      return Response.json({
        ok: false,
        error: { code: "DEMAND_NOT_FOUND", message: "这份需求不存在，请返回需求列表。" },
      } satisfies ApiFailure, { status: 404 });
    }
    return Response.json(result.response);
  } catch {
    return Response.json({
      ok: false,
      error: { code: "DATABASE_UNAVAILABLE", message: "需求数据暂时无法读取，请稍后重试。" },
    } satisfies ApiFailure, { status: 503 });
  }
}
