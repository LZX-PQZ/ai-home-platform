"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Schedule } from "@/contracts";
import type { ScheduleDTO } from "@/contracts";
import { apiGet } from "@/lib/api-client";

export type Phase = "loading" | "ready" | "failed";

export type ScheduleState = {
  phase: Phase;
  data: ScheduleDTO | null;
  source: "mock" | "live" | null;
  error: string | null;
};

/**
 * 读取施工排期（GET /api/schedule）。
 * 失败保留错误文案并可重试；不在前端兜造排期 —— 图上每一根条都必须来自接口。
 */
export function useSchedule() {
  const [state, setState] = useState<ScheduleState>({
    phase: "loading",
    data: null,
    source: null,
    error: null,
  });
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState((current) => ({ ...current, phase: "loading", error: null }));
    try {
      const result = await apiGet("/api/schedule", Schedule);
      setState({ phase: "ready", data: result.data, source: result.meta.source, error: null });
    } catch (cause) {
      setState({
        phase: "failed",
        data: null,
        source: null,
        error: cause instanceof Error ? cause.message : "施工进度加载失败。",
      });
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
}
