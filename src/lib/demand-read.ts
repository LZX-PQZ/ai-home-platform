import type { DemandOrder, Prisma, PrismaClient } from "@prisma/client";
import { Demand, DemandIdParams, ProviderIdentity, envelope, type ApiFailure, type OwnerIdentityDTO, type ProviderIdentityDTO } from "@/contracts";
import { DEMO_DEMAND_ID, toDemandDTO } from "@/lib/demand";
import { readDemoVerifiedSession } from "@/lib/demo-provider-session";
import { OWNER_SESSION_COOKIE, OwnerAccessError, readOwnerVerifiedSession } from "@/lib/owner-auth";
import { prisma } from "@/lib/prisma";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" } as const;
const failures = {
  VALIDATION_ERROR: { status: 400, message: "需求 ID 或查询参数不符合契约。" },
  UNAUTHENTICATED: { status: 401, message: "业主登录已失效，请重新登录或退出后浏览公开需求。" },
  FORBIDDEN: { status: 403, message: "当前身份没有需求读取权限。" },
  DEMAND_NOT_FOUND: { status: 404, message: "需求不存在或不可访问。" },
  DATABASE_UNAVAILABLE: { status: 503, message: "需求数据暂时无法读取，请稍后重试。" },
} as const;

class DemandReadRejected extends Error {
  constructor(readonly code: keyof typeof failures) { super(failures[code].message); }
}

function failure(code: keyof typeof failures) {
  const { status, message } = failures[code];
  return Response.json({ ok: false, error: { code, message } } satisfies ApiFailure, { status, headers });
}

async function readIdentity(request: Request, tx: Prisma.TransactionClient) {
  // An explicitly supplied owner credential must never fall back to public access.
  const hasOwnerCookie = (request.headers.get("cookie") ?? "").split(";")
    .some(value => value.trim().startsWith(`${OWNER_SESSION_COOKIE}=`));
  if (hasOwnerCookie) {
    const owner = await readOwnerVerifiedSession(request, tx);
    if (!owner) throw new DemandReadRejected("UNAUTHENTICATED");
    return owner;
  }
  const provider = await readDemoVerifiedSession(request, tx);
  // Provider authentication is optional for public reads; a valid demo session
  // still marks the overall response as mock without granting extra access.
  return provider ? ProviderIdentity.parse(provider) : null;
}

function checkedDemand(row: DemandOrder, identity: OwnerIdentityDTO | ProviderIdentityDTO | null, id?: string) {
  const owned = identity?.role === "owner" && row.ownerId === identity.userId;
  const allowed = id === undefined && identity?.role === "owner" ? owned : owned || row.status === "published";
  if ((id !== undefined && row.id !== id) || !allowed) {
    throw new DemandReadRejected("DATABASE_UNAVAILABLE");
  }
  return toDemandDTO(row);
}

/** One snapshot contains credential, current role/binding, scope-filtered SQL and DTO validation. */
async function readDemands(request: Request, id: string | undefined, db: Pick<PrismaClient, "$transaction">) {
  if (id !== undefined && !DemandIdParams.safeParse({ id }).success) return failure("VALIDATION_ERROR");
  if ([...new URL(request.url).searchParams.keys()].length !== 0) return failure("VALIDATION_ERROR");
  if (!["GET", "HEAD"].includes(request.method)) return failure("FORBIDDEN");

  try {
    const body = await db.$transaction(async tx => {
      const identity = await readIdentity(request, tx);
      if (id !== undefined) {
        const where: Prisma.DemandOrderWhereInput = identity?.role === "owner"
          ? { id, OR: [{ status: "published" }, { ownerId: identity.userId }] } : { id, status: "published" };
        const row = await tx.demandOrder.findFirst({ where });
        if (!row) throw new DemandReadRejected("DEMAND_NOT_FOUND");
        const data = checkedDemand(row, identity, id);
        const source = identity?.role === "provider" || row.id === DEMO_DEMAND_ID ? "mock" : "live";
        return envelope(Demand).parse({ ok: true, data, meta: { source } });
      }
      const where: Prisma.DemandOrderWhereInput = identity?.role === "owner"
        ? { ownerId: identity.userId } : { status: "published" };
      const rows = await tx.demandOrder.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }] });
      const data = rows.map(row => checkedDemand(row, identity));
      const source = identity?.role === "provider" || rows.some(row => row.id === DEMO_DEMAND_ID) ? "mock" : "live";
      return envelope(Demand.array()).parse({ ok: true, data, meta: { source } });
    }, { isolationLevel: "Serializable" });
    return Response.json(body, { headers });
  } catch (error) {
    if (error instanceof DemandReadRejected || error instanceof OwnerAccessError) return failure(error.code);
    return failure("DATABASE_UNAVAILABLE");
  }
}

export function handleDemandList(request: Request, db: Pick<PrismaClient, "$transaction"> = prisma) {
  return readDemands(request, undefined, db);
}

export function handleDemandDetail(request: Request, id: string, db: Pick<PrismaClient, "$transaction"> = prisma) {
  return readDemands(request, id, db);
}
