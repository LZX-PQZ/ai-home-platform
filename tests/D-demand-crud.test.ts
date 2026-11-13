import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/demand/route";
import { DELETE as detailDELETE, GET as detailGET, PUT as detailPUT } from "../src/app/api/demand/[id]/route";
import { createDemand, deleteDemand, findDemand, listDemands, updateDemand, type DemandDatabase } from "../src/lib/demand";

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
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const current = rows.find((value) => value.id === where.id);
        if (!current) throw new Error("missing row");
        Object.assign(current, data);
        return current as never;
      },
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

test("需求更新和删除只允许 draft 或未签约 published，并保留来源", async () => {
  const db = fakeDb();
  const updated = await updateDemand("demand-test", { ...input, city: "广州" }, db);
  assert.equal(updated.kind, "ok");
  if (updated.kind === "ok") {
    assert.equal(updated.data.city, "广州");
    assert.equal(updated.source, "live");
  }

  const demo = { ...row, id: "demo-demand" };
  const demoDb = fakeDb([demo]);
  assert.deepEqual(await updateDemand("demo-demand", input, demoDb), { kind: "demo-read-only" });
  assert.deepEqual(await deleteDemand("demo-demand", demoDb), { kind: "demo-read-only" });

  const relatedDb = fakeDb([row], { quotes: 1, schedules: 0, payments: 0, reviews: 0, tickets: 0 });
  assert.deepEqual((await deleteDemand("demand-test", relatedDb)).kind, "has-related-records");

  for (const status of ["contracted", "in_progress", "completed"]) {
    const lockedDb = fakeDb([{ ...row, status }]);
    assert.deepEqual((await updateDemand("demand-test", input, lockedDb)).kind, "invalid-state");
    assert.deepEqual((await deleteDemand("demand-test", lockedDb)).kind, "invalid-state");
  }
});

test("PUT/DELETE 路由拒绝空 ID、无效 JSON 与未知字段", async () => {
  const invalidId = await detailPUT(new Request("http://localhost/api/demand/%20", { method: "PUT" }), { params: { id: " " } });
  assert.equal(invalidId.status, 400);

  const invalidJson = await detailPUT(new Request("http://localhost/api/demand/demand-test", { method: "PUT", body: "{" }), { params: { id: "demand-test" } });
  assert.equal(invalidJson.status, 400);
  assert.deepEqual(await invalidJson.json(), { ok: false, error: { code: "INVALID_JSON", message: "请求不是有效 JSON。" } });

  const unknownField = await detailPUT(new Request("http://localhost/api/demand/demand-test", {
    method: "PUT",
    body: JSON.stringify({ ...input, status: "published" }),
  }), { params: { id: "demand-test" } });
  assert.equal(unknownField.status, 400);

  const deleteInvalidId = await detailDELETE(new Request("http://localhost/api/demand/%20", { method: "DELETE" }), { params: { id: " " } });
  assert.equal(deleteInvalidId.status, 400);
});
