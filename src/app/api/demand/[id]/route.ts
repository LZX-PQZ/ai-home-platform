import { DemandIdParams } from "@/contracts";
import { dataResponse } from "@/lib/api-response";
import { findDemand } from "@/lib/demand";
import { handleDemandDelete } from "@/lib/demand-delete";
import { handleDemandUpdate } from "@/lib/demand-update";

export const dynamic = "force-dynamic";

function parseDemandId(params: { id: string }) {
  return DemandIdParams.safeParse({ id: params.id.trim() });
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const parsedId = parseDemandId(params);
  if (!parsedId.success) {
    return Response.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "需求 ID 不能为空。" } }, { status: 400 });
  }
  try {
    const result = await findDemand(parsedId.data.id);
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

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  return handleDemandUpdate(request, params.id);
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  return handleDemandDelete(request, params.id);
}
