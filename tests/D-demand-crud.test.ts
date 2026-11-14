import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/demand/route";
import { DELETE as detailDELETE, GET as detailGET, PUT as detailPUT } from "../src/app/api/demand/[id]/route";
import { createDemand, deleteDemand, findDemand, listDemands, type DemandDatabase } from "../src/lib/demand";

const input = {
  description: "测试需求：浴室防滑改造。",
  city: "深圳",
  areaM2: 60,
  budgetMinCents: 3000000,
  budgetMaxCents: 5000000,
  renovationType: "elderly" as const,
  desiredDays: 30,
};

const row = { id: "demand-test", ...input, status: "published", ownerId: "demo-owner", createdAt: new Date() };

function fakeDb(rows: typeof row[] = [row], related: Record<string, number> = {}): DemandDatabase {
  return {
    user: { upsert: async () => ({}) },
    demandOrder: {
      findMany: async () => rows as never,
      findUnique: async ({ where, include }: { where: { id: string }; include?: unknown }) => {
        const found = rows.find((value) => value.id === where.id);
        if (!found) return null as never;
        return (include ? { ...found, _count: related } : found) as never;
      },
      create: async () => row as never,
      delete: async ({ where }: { where: { id: string } }) => {
        const index = rows.findIndex((value) => value.id === where.id);
        if (index < 0) throw new Error("missing row");
        return rows.splice(index, 1)[0] as never;
      },
    },
  } as unknown as DemandDatabase;
}

test("POST /api/demand 拒绝倒置预算", async () => {
  const response = await POST(new Request("http://localhost/api/demand", {
    method: "POST",
    body: JSON.stringify({ ...input, budgetMinCents: 6000000 }),
  }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, error: { code: "VALIDATION_ERROR", message: "需求字段不符合契约。" } });
});

test("需求服务从数据库读取，并避免混合列表把演示需求标成 live", async () => {
  const result = await listDemands(fakeDb());
  assert.equal(result.source, "live");
  assert.equal(result.data[0].id, row.id);
  const created = await createDemand(input, fakeDb());
  assert.equal(created.status, "published");
  const demo = await listDemands(fakeDb([{ ...row, id: "demo-demand" }]));
  assert.equal(demo.source, "mock");
  const mixed = await listDemands(fakeDb([{ ...row, id: "demo-demand" }, row]));
  assert.equal(mixed.source, "mock");
});

test("GET /api/demand/[id] 拒绝空 ID，服务详情对未知 ID 返回空", async () => {
  const invalid = await detailGET(new Request("http://localhost/api/demand/%20"), { params: { id: " " } });
  assert.equal(invalid.status, 400);
  const missing = await findDemand("missing", fakeDb([]));
  assert.equal(missing, null);
});

test("需求删除保留状态和关联约束；更新权限由隔离数据库鉴权测试覆盖", async () => {
  const demo = { ...row, id: "demo-demand" };
  const demoDb = fakeDb([demo]);
  assert.deepEqual(await deleteDemand("demo-demand", demoDb), { kind: "demo-read-only" });

  const relatedDb = fakeDb([row], { quotes: 1, schedules: 0, payments: 0, reviews: 0, tickets: 0 });
  assert.deepEqual((await deleteDemand("demand-test", relatedDb)).kind, "has-related-records");

  for (const status of ["contracted", "in_progress", "completed"]) {
    const lockedDb = fakeDb([{ ...row, status }]);
    assert.deepEqual((await deleteDemand("demand-test", lockedDb)).kind, "invalid-state");
  }
});

test("PUT/DELETE 路由拒绝空 ID，PUT 同源校验先于请求体读取", async () => {
  const invalidId = await detailPUT(new Request("http://localhost/api/demand/%20", { method: "PUT" }), { params: { id: " " } });
  assert.equal(invalidId.status, 400);

  const noOrigin = new Request("http://localhost/api/demand/demand-test", { method: "PUT", body: "{" });
  const forbidden = await detailPUT(noOrigin, { params: { id: "demand-test" } });
  assert.equal(forbidden.status, 403);
  assert.equal(noOrigin.bodyUsed, false);

  const deleteInvalidId = await detailDELETE(new Request("http://localhost/api/demand/%20", { method: "DELETE" }), { params: { id: " " } });
  assert.equal(deleteInvalidId.status, 400);
});
