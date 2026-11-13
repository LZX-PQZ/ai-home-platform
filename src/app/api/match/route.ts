import { Id, type ApiFailure } from "@/contracts";
import { loadMatchData } from "@/lib/match/data";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const ids = new URL(request.url).searchParams.getAll("demandId");
  if (ids.length > 1 || (ids.length === 1 && !Id.safeParse(ids[0].trim()).success)) {
    return Response.json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "请提供一个非空的需求 ID。" },
    } satisfies ApiFailure, { status: 400 });
  }
  // 保留不带参数时的原演示入口；显式传入的 ID 必须确实存在。
  const result = loadMatchData(ids[0]);
  if (!result) {
    return Response.json({
      ok: false,
      error: { code: "DEMAND_NOT_FOUND", message: "当前演示数据中没有这份需求，请返回需求列表。" },
    } satisfies ApiFailure, { status: 404 });
  }
  return Response.json(result.response);
}
