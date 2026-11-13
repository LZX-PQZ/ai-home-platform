import test from "node:test";
import assert from "node:assert/strict";
import { ChatInput, ChatResult } from "../src/contracts";
import { POST } from "../src/app/api/demand/chat/route";
import { callLlmJson, clarifyDemand, LlmUnavailableError } from "../src/lib/llm";

const input = ChatInput.parse({ messages: [{ role: "user", content: "我想改造深圳的老人房" }] });
const envKeys = ["AI_MODE", "LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL", "LLM_TIMEOUT_MS", "LLM_MAX_RETRIES"] as const;
const savedEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));

function restoreEnv() {
  for (const key of envKeys) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test.afterEach(restoreEnv);

test("mock 模式返回 ChatResult 并标记 mock 来源", async () => {
  process.env.AI_MODE = "mock";
  const result = await clarifyDemand(input);
  assert.equal(result.source, "mock");
  assert.equal(result.data.ready, false);
  assert.ok(result.data.missingFields.includes("city"));
});

test("需求澄清 API 使用实际来源信封", async () => {
  process.env.AI_MODE = "mock";
  const response = await POST(new Request("http://localhost/api/demand/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).meta, { source: "mock" });
});

test("live 模式缺少配置时返回不可用，不调用外部服务", async () => {
  process.env.AI_MODE = "live";
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_BASE_URL;
  delete process.env.LLM_MODEL;
  const response = await POST(new Request("http://localhost/api/demand/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }));
  assert.equal(response.status, 503);
  assert.deepEqual((await response.json()).error.code, "AI_UNAVAILABLE");
});

test("live 模式只接受经过契约校验的 JSON，并标记 live 来源", async (t) => {
  process.env.AI_MODE = "live";
  process.env.LLM_API_KEY = "test-key";
  process.env.LLM_BASE_URL = "https://llm.example/v1";
  process.env.LLM_MODEL = "test-model";
  const calls: Array<{ url: string; body: string }> = [];
  t.mock.method(globalThis, "fetch", async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: String(init?.body) });
    return Response.json({ choices: [{ message: { content: JSON.stringify({ reply: "请补充面积", ready: false, draft: null, missingFields: ["areaM2"] }) } }] });
  });

  const result = await clarifyDemand(input);
  assert.equal(result.source, "live");
  assert.equal(result.data.reply, "请补充面积");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://llm.example/v1/chat/completions");
  assert.match(calls[0].body, /test-model/);
});

test("live 模式的非法响应在有限重试后失败", async (t) => {
  process.env.LLM_API_KEY = "test-key";
  process.env.LLM_BASE_URL = "https://llm.example/v1";
  process.env.LLM_MODEL = "test-model";
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    return Response.json({ choices: [{ message: { content: "不是 JSON" } }] });
  });

  await assert.rejects(() => callLlmJson(ChatResult, [], { maxRetries: 2 }), (error: unknown) => {
    assert.ok(error instanceof LlmUnavailableError);
    assert.match((error as Error).message, /JSON/);
    return true;
  });
  assert.equal(calls, 3);
});

test("live 模式超时会中止请求并遵守重试上限", async (t) => {
  process.env.LLM_API_KEY = "test-key";
  process.env.LLM_BASE_URL = "https://llm.example/v1";
  process.env.LLM_MODEL = "test-model";
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url: string | URL, init?: RequestInit) => {
    calls += 1;
    await new Promise<void>((resolve) => {
      init?.signal?.addEventListener("abort", () => resolve(), { once: true });
    });
    throw new Error("aborted");
  });

  await assert.rejects(() => callLlmJson(ChatResult, [], { timeoutMs: 1, maxRetries: 2 }), LlmUnavailableError);
  assert.equal(calls, 3);
});
