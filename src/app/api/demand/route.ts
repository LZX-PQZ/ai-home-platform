import { dataResponse } from "@/lib/api-response";
import { listDemands } from "@/lib/demand";
import { handleDemandCreate } from "@/lib/demand-create";

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
  return handleDemandCreate(request);
}
