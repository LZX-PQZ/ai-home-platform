import type { DemandOrder } from "@prisma/client";
import { Demand, type DemandDTO, type DemandInputDTO, type DemandUpdateInputDTO, type SourceDTO } from "@/contracts";
import { prisma } from "@/lib/prisma";

export type DemandDatabase = {
  user: Pick<typeof prisma.user, "upsert">;
  demandOrder: Pick<
    typeof prisma.demandOrder,
    "findMany" | "findUnique" | "create" | "update" | "delete"
  >;
};

export const DEMO_OWNER_ID = "demo-owner";
export const DEMO_DEMAND_ID = "demo-demand";
export const EDITABLE_DEMAND_STATUSES = ["draft", "published"] as const;

export function demandItemSource(id: string): SourceDTO {
  return id === DEMO_DEMAND_ID ? "mock" : "live";
}

export function isEditableDemandStatus(status: string): status is (typeof EDITABLE_DEMAND_STATUSES)[number] {
  return EDITABLE_DEMAND_STATUSES.includes(status as (typeof EDITABLE_DEMAND_STATUSES)[number]);
}

/** 只把数据库字段映射为公共 Demand 契约，避免路由暴露 Prisma 记录。 */
export function toDemandDTO(row: Pick<
  DemandOrder,
  "id" | "description" | "city" | "areaM2" | "budgetMinCents" | "budgetMaxCents" | "renovationType" | "desiredDays" | "status"
>): DemandDTO {
  return Demand.parse({
    id: row.id,
    description: row.description,
    city: row.city,
    areaM2: row.areaM2,
    budgetMinCents: row.budgetMinCents,
    budgetMaxCents: row.budgetMaxCents,
    renovationType: row.renovationType,
    desiredDays: row.desiredDays,
    status: row.status,
    source: demandItemSource(row.id),
  });
}

export function demandSource(rows: Array<{ id: string }>): SourceDTO {
  // 列表响应只有一个 meta.source；混入演示需求时整体保持 mock，避免把 demo-demand 宣称为实时数据。
  return rows.length > 0 && rows.every((row) => row.id !== DEMO_DEMAND_ID) ? "live" : "mock";
}

export async function listDemands(db: DemandDatabase = prisma) {
  const rows = await db.demandOrder.findMany({ orderBy: { createdAt: "desc" } });
  return { data: rows.map(toDemandDTO), source: demandSource(rows) };
}

export async function findDemand(id: string, db: DemandDatabase = prisma) {
  const row = await db.demandOrder.findUnique({ where: { id } });
  if (!row) return null;
  return { data: toDemandDTO(row), source: demandSource([row]) };
}

export async function createDemand(input: DemandInputDTO, db: DemandDatabase = prisma) {
  // 当前没有鉴权，所有提交先归属本地演示业主；接入鉴权后由服务端会话替换。
  await db.user.upsert({
    where: { id: DEMO_OWNER_ID },
    update: {},
    create: { id: DEMO_OWNER_ID, name: "演示业主", role: "owner" },
  });
  const row = await db.demandOrder.create({
    data: {
      ...input,
      ownerId: DEMO_OWNER_ID,
      status: "published",
    },
  });
  return toDemandDTO(row);
}

export type DemandMutationResult<T> =
  | { kind: "ok"; data: T; source: SourceDTO }
  | { kind: "not-found" }
  | { kind: "invalid-state"; status: string }
  | { kind: "demo-read-only" };

export type DemandDeleteResult = DemandMutationResult<{ id: string; deleted: true }> | { kind: "has-related-records"; related: string[] };

export async function updateDemand(
  id: string,
  input: DemandUpdateInputDTO,
  db: DemandDatabase = prisma,
): Promise<DemandMutationResult<DemandDTO>> {
  const existing = await db.demandOrder.findUnique({ where: { id } });
  if (!existing) return { kind: "not-found" };
  if (id === DEMO_DEMAND_ID) return { kind: "demo-read-only" };
  if (!isEditableDemandStatus(existing.status)) return { kind: "invalid-state", status: existing.status };

  const row = await db.demandOrder.update({ where: { id }, data: input });
  return { kind: "ok", data: toDemandDTO(row), source: demandSource([row]) };
}

export async function deleteDemand(
  id: string,
  db: DemandDatabase = prisma,
): Promise<DemandDeleteResult> {
  const existing = await db.demandOrder.findUnique({
    where: { id },
    include: { _count: { select: { quotes: true, schedules: true, payments: true, reviews: true, tickets: true } } },
  });
  if (!existing) return { kind: "not-found" };
  if (id === DEMO_DEMAND_ID) return { kind: "demo-read-only" };
  if (!isEditableDemandStatus(existing.status)) return { kind: "invalid-state", status: existing.status };

  const related = Object.entries(existing._count)
    .filter(([, count]) => count > 0)
    .map(([name]) => name);
  if (related.length > 0) return { kind: "has-related-records", related };

  await db.demandOrder.delete({ where: { id } });
  return { kind: "ok", data: { id, deleted: true }, source: demandSource([existing]) };
}
