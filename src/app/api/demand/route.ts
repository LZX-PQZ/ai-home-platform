import { DemandInput } from "@/contracts";
import { dataResponse, liveResponse } from "@/lib/api-response";
import { createDemand, listDemands } from "@/lib/demand";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await listDemands();
    return dataResponse(result.data, result.source);
  } catch {
    return Response.json(
      { ok: false, error: { code: "DATABASE_UNAVAILABLE", message: "需求数据暂时无法读取。" } },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ ok: false, error: { code: "INVALID_JSON", message: "请求不是有效 JSON。" } }, { status: 400 });
  }
  const input = DemandInput.safeParse(json);
  if (!input.success) {
    return Response.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "需求字段不符合契约。" } }, { status: 400 });
  }
  try {
    return liveResponse(await createDemand(input.data), 201);
  } catch {
    return Response.json(
      { ok: false, error: { code: "DATABASE_UNAVAILABLE", message: "需求暂时无法保存。" } },
      { status: 503 },
    );
  }
}
