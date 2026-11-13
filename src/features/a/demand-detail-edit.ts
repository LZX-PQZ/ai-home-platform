import { Demand, DemandDeleteResult, DemandIdParams, envelope } from "@/contracts";
import type { DemandDTO, DemandDeleteResultDTO, SourceDTO } from "@/contracts";
import { ApiClientError } from "@/lib/api-client";
import { formToInput, type DemandForm } from "./demand-chat";

type Failure = { ok: false; error: { code: string; message: string } };

export type DemandMutationOutcome =
  | { kind: "updated"; demand: DemandDTO; source: SourceDTO }
  | { kind: "deleted"; result: DemandDeleteResultDTO; source: SourceDTO }
  | { kind: "rejected"; messages: string[] }
  | { kind: "failed"; message: string; status: number; code: string };

function failureMessage(status: number, code: string, message: string) {
  if (status === 501) return `需求修改接口尚未开放（${code}）：${message}`;
  if (status === 409) return `当前需求状态不允许修改（${code}）：${message}`;
  if (status === 401) return `请先登录后再修改需求（${code}）。`;
  if (status === 403) return `没有权限修改这条需求（${code}）。`;
  if (status >= 500) return `需求服务暂时不可用（${code}）：${message}`;
  return `${message}（${code}，HTTP ${status}）`;
}

async function requestMutation(path: string, init: RequestInit) {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiClientError("网络请求失败。", "NETWORK_ERROR", 0);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiClientError(
      `接口返回不是有效 JSON（HTTP ${response.status}）。`,
      "INVALID_RESPONSE",
      response.status,
    );
  }

  if (!response.ok) {
    const parsed = (payload && typeof payload === "object" ? payload : {}) as Partial<Failure>;
    const error = parsed.error && typeof parsed.error === "object" ? parsed.error : null;
    throw new ApiClientError(
      error && typeof error.message === "string" ? error.message : `接口请求失败（HTTP ${response.status}）。`,
      error && typeof error.code === "string" ? error.code : `HTTP_${response.status}`,
      response.status,
    );
  }
  return { payload, status: response.status };
}

function parseMutationFailure(cause: unknown): DemandMutationOutcome {
  if (cause instanceof ApiClientError) {
    return {
      kind: "failed",
      message: cause.code === "NETWORK_ERROR"
        ? "网络请求失败，请检查连接后重试。"
        : failureMessage(cause.status, cause.code, cause.message),
      status: cause.status,
      code: cause.code,
    };
  }
  return { kind: "failed", message: "未收到有效的接口结果，请刷新详情后再试。", status: 0, code: "UNKNOWN_ERROR" };
}

export function demandCanMutate(demand: DemandDTO): boolean {
  return demand.id !== "demo-demand" && (demand.status === "draft" || demand.status === "published");
}

export function demandFormFromDetail(demand: DemandDTO): DemandForm {
  return {
    description: demand.description,
    city: demand.city,
    areaM2: String(demand.areaM2),
    budgetMinYuan: (demand.budgetMinCents / 100).toFixed(2).replace(/\.00$/, ""),
    budgetMaxYuan: (demand.budgetMaxCents / 100).toFixed(2).replace(/\.00$/, ""),
    renovationType: demand.renovationType,
    desiredDays: String(demand.desiredDays),
  };
}

export async function updateDemand(id: string, form: DemandForm): Promise<DemandMutationOutcome> {
  const params = DemandIdParams.safeParse({ id });
  if (!params.success) return { kind: "rejected", messages: ["需求编号无效，请检查链接。"] };
  const checked = formToInput(form);
  if (!checked.ok) return { kind: "rejected", messages: checked.messages };

  try {
    const response = await requestMutation(`/api/demand/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(checked.value),
    });
    const parsed = envelope(Demand).safeParse(response.payload);
    if (!parsed.success || parsed.data.data.id !== id) {
      return { kind: "failed", message: "更新响应不符合需求契约，已停止展示新数据。", status: response.status, code: "INVALID_RESPONSE" };
    }
    return { kind: "updated", demand: parsed.data.data, source: parsed.data.meta.source };
  } catch (cause) {
    return parseMutationFailure(cause);
  }
}

export async function deleteDemand(id: string): Promise<DemandMutationOutcome> {
  const params = DemandIdParams.safeParse({ id });
  if (!params.success) return { kind: "rejected", messages: ["需求编号无效，请检查链接。"] };

  try {
    const response = await requestMutation(`/api/demand/${encodeURIComponent(id)}`, { method: "DELETE" });
    const parsed = envelope(DemandDeleteResult).safeParse(response.payload);
    if (!parsed.success || parsed.data.data.id !== id || !parsed.data.data.deleted) {
      return { kind: "failed", message: "删除响应不符合需求契约，已停止继续操作。", status: response.status, code: "INVALID_RESPONSE" };
    }
    return { kind: "deleted", result: parsed.data.data, source: parsed.data.meta.source };
  } catch (cause) {
    return parseMutationFailure(cause);
  }
}
