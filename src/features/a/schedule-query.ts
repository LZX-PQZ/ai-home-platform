import { Schedule, ScheduleQuery } from "@/contracts";
import type { ScheduleDTO, SourceDTO } from "@/contracts";
import { apiGet, ApiClientError } from "@/lib/api-client";

export type ScheduleState = {
  phase: "loading" | "ready" | "missing" | "failed";
  data: ScheduleDTO | null;
  source: SourceDTO | null;
  error: string | null;
};

export const SCHEDULE_LOADING: ScheduleState = {
  phase: "loading", data: null, source: null, error: null,
};

/** 省略 version 读取当前需求的最新版本；失败时不回退到演示排期。 */
export async function loadSchedule(id: string): Promise<ScheduleState> {
  const failed = (error: string): ScheduleState => ({ phase: "failed", data: null, source: null, error });
  if (!ScheduleQuery.safeParse({ demandId: id }).success) {
    return failed("需求编号无效，请检查链接。");
  }
  try {
    const result = await apiGet(`/api/schedule?demandId=${encodeURIComponent(id)}`, Schedule);
    if (result.data.demandId !== id) return failed("接口返回了另一条需求的排期，已停止展示，请重新加载。");
    return { phase: "ready", data: result.data, source: result.meta.source, error: null };
  } catch (cause) {
    if (cause instanceof ApiClientError) {
      if (cause.status === 404 && cause.code === "SCHEDULE_NOT_FOUND") {
        return { phase: "missing", data: null, source: null, error: null };
      }
      if (cause.status === 501) return failed("排期读取接口尚未开放（HTTP 501），请稍后重试。");
      return failed(cause.message);
    }
    return failed("施工进度加载失败，请重新加载。");
  }
}
