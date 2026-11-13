"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DemandDTO } from "@/contracts";
import { apiGet } from "@/lib/api-client";
import { DemandWithSource } from "./demand-source";

export type ListPhase = "loading" | "ready" | "failed";

export type DemandListState = {
  phase: ListPhase;
  items: DemandDTO[];
  source: "mock" | "live" | null;
  error: string | null;
};

/**
 * 读取需求列表（GET /api/demand）。
 * 失败时保留错误文案并可重试；不缓存、不本地兜造数据 —— 页面上看到的每条都必须来自接口。
 */
export function useDemandList() {
  const [state, setState] = useState<DemandListState>({
    phase: "loading",
    items: [],
    source: null,
    error: null,
  });
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState((current) => ({ ...current, phase: "loading", error: null }));
    try {
      const result = await apiGet("/api/demand", DemandWithSource.array());
      setState({ phase: "ready", items: result.data, source: result.meta.source, error: null });
    } catch (cause) {
      setState({
        phase: "failed",
        items: [],
        source: null,
        error: cause instanceof Error ? cause.message : "需求列表加载失败。",
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
