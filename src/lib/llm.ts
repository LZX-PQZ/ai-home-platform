import { ChatResult, type ChatInputDTO, type ChatResultDTO, type SourceDTO } from "@/contracts";
import { z } from "zod";

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_RETRIES = 2;

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmResult<T> = {
  data: T;
  source: SourceDTO;
};

export type LlmJsonOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

class LlmAttemptError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable = true) {
    super(message);
    this.name = "LlmAttemptError";
    this.retryable = retryable;
  }
}

function positiveInteger(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function endpointFor(baseUrl: string) {
  const normalized = baseUrl.replace(/\/+$/, "");
  return normalized.endsWith("/chat/completions") ? normalized : `${normalized}/chat/completions`;
}

function extractJsonText(content: string) {
  const trimmed = content.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  const firstLineEnd = trimmed.indexOf("\n");
  const withoutOpeningFence = firstLineEnd >= 0 ? trimmed.slice(firstLineEnd + 1) : trimmed.slice(3);
  return withoutOpeningFence.replace(/```\s*$/, "").trim();
}

function responseContent(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: unknown } | undefined)?.message;
  const content = (message as { content?: unknown } | undefined)?.content;
  return typeof content === "string" ? content : null;
}

/**
 * 调用 OpenAI 兼容的 JSON 输出接口。返回值必须经过调用方提供的 Zod 契约校验。
 * 失败只抛出不可用错误，避免把外部响应直接当作业务成功。
 */
export async function callLlmJson<T extends z.ZodTypeAny>(
  schema: T,
  messages: LlmMessage[],
  options: LlmJsonOptions = {},
): Promise<z.infer<T>> {
  const apiKey = options.apiKey ?? process.env.LLM_API_KEY;
  const baseUrl = options.baseUrl ?? process.env.LLM_BASE_URL;
  const model = options.model ?? process.env.LLM_MODEL;
  if (!apiKey || !baseUrl || !model) {
    throw new LlmUnavailableError("AI 服务配置不完整。");
  }

  const timeoutMs = options.timeoutMs ?? positiveInteger(process.env.LLM_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 30_000);
  const maxRetries = options.maxRetries ?? positiveInteger(process.env.LLM_MAX_RETRIES, DEFAULT_MAX_RETRIES, 3);
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = endpointFor(baseUrl);
  const payload = {
    model,
    messages,
    temperature: 0,
    response_format: { type: "json_object" },
  };

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let response: Response;
      try {
        response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch {
        throw new LlmAttemptError("AI 请求失败。");
      }

      if (!response.ok) {
        const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
        throw new LlmAttemptError(`AI 服务返回 HTTP ${response.status}。`, retryable);
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new LlmAttemptError("AI 服务返回的不是有效 JSON。");
      }
      const content = responseContent(body);
      if (!content) throw new LlmAttemptError("AI 服务没有返回 JSON 内容。");

      let candidate: unknown;
      try {
        candidate = JSON.parse(extractJsonText(content));
      } catch {
        throw new LlmAttemptError("AI 服务返回的内容不是有效 JSON。");
      }
      const parsed = schema.safeParse(candidate);
      if (!parsed.success) throw new LlmAttemptError("AI 服务返回内容不符合业务契约。");
      return parsed.data;
    } catch (error) {
      lastError = error;
      if (!(error instanceof LlmAttemptError) || !error.retryable || attempt >= maxRetries) break;
    } finally {
      clearTimeout(timeout);
    }
  }

  const detail = lastError instanceof Error ? lastError.message : "未知错误";
  throw new LlmUnavailableError(`AI 服务暂时不可用：${detail}`);
}

const mockChatResult: ChatResultDTO = {
  reply: "【模拟助手】请补充城市、面积、预算范围、改造类型和期望工期。",
  ready: false,
  draft: null,
  missingFields: ["city", "areaM2", "budgetMinCents", "budgetMaxCents", "renovationType", "desiredDays"],
};

/** 需求澄清只返回公共契约，并把数据来源交给 API 层写入响应信封。 */
export async function clarifyDemand(input: ChatInputDTO): Promise<LlmResult<ChatResultDTO>> {
  if (process.env.AI_MODE !== "live") {
    return { data: ChatResult.parse(mockChatResult), source: "mock" };
  }

  const data = await callLlmJson(
    ChatResult,
    [
      {
        role: "system",
        content: "你是家装需求澄清助手。只返回符合 ChatResult JSON 契约的对象，不要返回 Markdown 或额外文字。金额使用人民币分，不能臆造用户没有提供的信息。",
      },
      ...input.messages,
    ],
  );
  return { data: ChatResult.parse(data), source: "live" };
}
