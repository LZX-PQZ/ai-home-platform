"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { demandRecoveryErrorMessage, exitDemandOwnerSession } from "./demand-access-recovery";

type RecoveryState = { status: "idle" | "pending" } | { status: "error"; message: string };

export function DemandAccessRecoveryContent({ state, onExit }: {
  state: RecoveryState;
  onExit: () => void;
}) {
  return (
    <aside aria-label="退出业主会话以恢复公开需求浏览" className="mt-4 border-t border-line pt-4">
      <p className="text-sm text-ink-2">此操作会退出当前浏览器的业主登录并刷新本页，演示服务方登录不受影响。可查看的需求以重新查询结果为准。</p>
      <Button type="button" variant="secondary" disabled={state.status === "pending"} onClick={onExit}
        className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        {state.status === "pending" ? "正在退出业主会话…" : "退出业主会话并刷新页面"}
      </Button>
      {state.status === "pending" && <p role="status" aria-live="polite" className="mt-2 !mb-0 text-sm">正在等待退出结果，确认成功后才刷新。</p>}
      {state.status === "error" && <p role="alert" className="mt-2 !mb-0 text-sm text-danger">{state.message}</p>}
    </aside>
  );
}

export function DemandAccessRecovery() {
  const [state, setState] = useState<RecoveryState>({ status: "idle" });
  const active = useRef(false);
  const busy = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  async function exit() {
    if (busy.current) return;
    busy.current = true;
    setState({ status: "pending" });
    try {
      await exitDemandOwnerSession();
      // Refresh both the shared login banner and demand query after verified logout.
      if (active.current) window.location.reload();
    } catch (error) {
      if (active.current) {
        busy.current = false;
        setState({ status: "error", message: demandRecoveryErrorMessage(error) });
      }
    }
  }

  return <DemandAccessRecoveryContent state={state} onExit={() => { void exit(); }} />;
}
