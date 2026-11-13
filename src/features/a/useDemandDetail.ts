"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Demand } from "@/contracts";
import type { DemandDTO } from "@/contracts";
import { apiGet } from "@/lib/api-client";
import { interpretDetailResponse } from "./demand-detail";
import type { DetailVia } from "./demand-detail";
import { findDemand } from "./demand-list";

export type DetailPhase = "loading" | "ready" | "missing" | "failed";

export type DemandDetailState = {
  phase: DetailPhase;
  demand: DemandDTO | null;
  source: "mock" | "live" | null;
  via: DetailVia | null;
  /** 回退原因（按 ID 接口未开放时给出具体说明），通过 byId 命中时为 null */
  fallbackReason: string | null;
  error: string | null;
};

const EMPTY: DemandDetailState = {
  phase: "loading",
  demand: null,
  source: null,
  via: null,
  fallbackReason: null,
  error: null,
};

/**
 * 读取单条需求。
 * 首选 GET /api/demand/[id]；接口未开放（404/501）、返回异常或网络失败时，
 * 自动回退到 GET /api/demand 列表里按 ID 查找 —— 两条路径都会如实记录在 via 上，
 * 页面据此标注数据是怎么来的，绝不拿别的需求冒充。
 */
export function useDemandDetail(id: string) {
  const [state, setState] = useState<DemandDetailState>(EMPTY);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState((current) => ({ ...current, phase: "loading", error: null }));
    try {
      let fallbackReason: string | null = null;

      // 1) 首选按 ID 查询
      try {
        const response = await fetch(`/api/demand/${encodeURIComponent(id)}`);
        let payload: unknown = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }
        const probe = interpretDetailResponse(response.status, payload, id);
        if (probe.kind === "demand") {
          setState({
            phase: "ready",
            demand: probe.demand,
            source: probe.source,
            via: "byId",
            fallbackReason: null,
            error: null,
          });
          return;
        }
        fallbackReason = probe.reason;
      } catch {
        fallbackReason = "按 ID 查询网络异常，已回退到列表查找";
      }

      // 2) 回退：从列表里按 ID 找（列表本身失败才算 failed）
      const list = await apiGet("/api/demand", Demand.array());
      const found = findDemand(list.data, id);
      if (!found) {
        setState({
          phase: "missing",
          demand: null,
          source: list.meta.source,
          via: "list",
          fallbackReason,
          error: null,
        });
        return;
      }
      setState({
        phase: "ready",
        demand: found,
        source: list.meta.source,
        via: "list",
        fallbackReason,
        error: null,
      });
    } catch (cause) {
      setState({
        ...EMPTY,
        phase: "failed",
        error: cause instanceof Error ? cause.message : "需求详情加载失败。",
      });
    } finally {
      inFlight.current = false;
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
}
