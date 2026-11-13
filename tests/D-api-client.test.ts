import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { ApiClientError, apiGet, apiPost } from "../src/lib/api-client";

const responseSchema = z.object({ id: z.string(), accepted: z.boolean() });

test("apiPost 发送 JSON 并返回契约数据与来源", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async (input: string, init?: RequestInit) => {
    assert.equal(input, "/api/demand");
    assert.equal(init?.method, "POST");
    assert.equal(init?.headers && new Headers(init.headers).get("content-type"), "application/json");
    assert.deepEqual(JSON.parse(String(init?.body)), { description: "测试" });
    return Response.json({ ok: true, data: { id: "demand-1", accepted: true }, meta: { source: "live" } }, { status: 201 });
  });

  const result = await apiPost("/api/demand", { description: "测试" }, responseSchema);
  assert.deepEqual(result, { data: { id: "demand-1", accepted: true }, source: "live" });
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("apiPost 暴露失败信封的 code 与 HTTP status，包括 501", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json(
    { ok: false, error: { code: "NOT_IMPLEMENTED", message: "尚未开放" } },
    { status: 501 },
  ));

  await assert.rejects(
    apiPost("/api/demand", {}, responseSchema),
    (error: unknown) => {
      assert.ok(error instanceof ApiClientError);
      assert.equal(error.code, "NOT_IMPLEMENTED");
      assert.equal(error.status, 501);
      assert.match(error.message, /HTTP 501/);
      return true;
    },
  );
});

test("apiGet 对 HTTP 200 的错误响应和坏 JSON 都失败并带 code", async (t) => {
  const payloads = [
    Response.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "输入错误" } }, { status: 200 }),
    new Response("not json", { status: 200 }),
  ];
  for (const payload of payloads) {
    t.mock.method(globalThis, "fetch", async () => payload);
    await assert.rejects(apiGet("/api/demand", z.array(z.string())), (error: unknown) => {
      assert.ok(error instanceof ApiClientError);
      assert.equal(typeof error.code, "string");
      return true;
    });
    t.mock.restoreAll();
  }
});

