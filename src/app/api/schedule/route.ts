import { ScheduleQuery } from "@/contracts";
import { dataResponse, mockResponse, notImplemented } from "@/lib/api-response";
import { schedule } from "@/lib/mock-data";
import { findSchedule } from "@/lib/schedule";

function parseScheduleQuery(request: Request) {
  const url = new URL(request.url);
  const demandIds = url.searchParams.getAll("demandId");
  const versions = url.searchParams.getAll("version");

  if (demandIds.length === 0 && versions.length === 0) return { kind: "demo" as const };
  if (demandIds.length !== 1 || versions.length > 1 || !demandIds[0]?.trim()) return { kind: "invalid" as const };

  const versionText = versions[0];
  if (versionText !== undefined && !/^\d+$/.test(versionText)) return { kind: "invalid" as const };
  const parsed = ScheduleQuery.safeParse({
    demandId: demandIds[0].trim(),
    version: versionText === undefined ? undefined : Number(versionText),
  });
  return parsed.success ? { kind: "query" as const, data: parsed.data } : { kind: "invalid" as const };
}

export async function GET(request: Request) {
  const query = parseScheduleQuery(request);
  if (query.kind === "demo") return mockResponse(schedule);
  if (query.kind === "invalid") {
    return Response.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "排期查询参数不符合契约。" } }, { status: 400 });
  }

  try {
    const result = await findSchedule(query.data);
    if (!result) {
      return Response.json({ ok: false, error: { code: "SCHEDULE_NOT_FOUND", message: "当前需求没有对应排期版本。" } }, { status: 404 });
    }
    return dataResponse(result.data, result.source);
  } catch {
    return Response.json({ ok: false, error: { code: "SCHEDULE_UNAVAILABLE", message: "排期数据暂时无法读取。" } }, { status: 503 });
  }
}

export const POST=notImplemented;
