"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadDemandDetail, type DemandDetailState } from "./demand-detail";

const LOADING: DemandDetailState = { phase: "loading" };

/** 只让最新请求更新页面；切换 ID 时立即隐藏上一条需求和它的操作链接。 */
export function useDemandDetail(id: string) {
  const [snapshot, setSnapshot] = useState<{ id: string; state: DemandDetailState }>({ id, state: LOADING });
  const requestVersion = useRef(0);

  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    setSnapshot({ id, state: LOADING });
    const state = await loadDemandDetail(id);
    if (version === requestVersion.current) setSnapshot({ id, state });
  }, [id]);

  useEffect(() => {
    void reload();
    return () => { requestVersion.current++; };
  }, [reload]);

  return { state: snapshot.id === id ? snapshot.state : LOADING, reload };
}
