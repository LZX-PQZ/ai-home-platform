import { DemandIdParams, DemandUpdateInput } from "@/contracts";
import { dataResponse } from "@/lib/api-response";
import { deleteDemand, findDemand, updateDemand } from "@/lib/demand";

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
  const parsedId = parseDemandId(params);
  if (!parsedId.success) {
    return Response.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "需求 ID 不能为空。" } }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ ok: false, error: { code: "INVALID_JSON", message: "请求不是有效 JSON。" } }, { status: 400 });
  }
  const input = DemandUpdateInput.safeParse(json);
  if (!input.success) {
    return Response.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "需求字段不符合契约。" } }, { status: 400 });
  }

  try {
    const result = await updateDemand(parsedId.data.id, input.data);
    if (result.kind === "not-found") {
      return Response.json({ ok: false, error: { code: "DEMAND_NOT_FOUND", message: "需求不存在。" } }, { status: 404 });
    }
    if (result.kind === "invalid-state") {
      return Response.json({ ok: false, error: { code: "INVALID_STATE", message: "当前状态的需求不可更新。" } }, { status: 409 });
    }
    return dataResponse(result.data, result.source);
  } catch {
    return Response.json(
      { ok: false, error: { code: "DATABASE_UNAVAILABLE", message: "需求暂时无法更新。" } },
      { status: 503 },
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const parsedId = parseDemandId(params);
  if (!parsedId.success) {
    return Response.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "需求 ID 不能为空。" } }, { status: 400 });
  }

  try {
    const result = await deleteDemand(parsedId.data.id);
    if (result.kind === "not-found") {
      return Response.json({ ok: false, error: { code: "DEMAND_NOT_FOUND", message: "需求不存在。" } }, { status: 404 });
    }
    if (result.kind === "invalid-state") {
      return Response.json({ ok: false, error: { code: "INVALID_STATE", message: "当前状态的需求不可删除。" } }, { status: 409 });
    }
    return dataResponse(result.data, result.source);
  } catch {
    return Response.json(
      { ok: false, error: { code: "DATABASE_UNAVAILABLE", message: "需求暂时无法删除。" } },
      { status: 503 },
    );
  }
}
