"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { RoleLogin } from "./RoleLogin";

/**
 * 顶栏右侧仅显示当前端的账号状态与登录入口。
 * 浮层关闭时组件仍保持挂载，会话刷新与到期检查照常运行。
 */
export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = usePathname();
  useEffect(() => { setOpen(false); }, [pathname]);
  const onStatus = useCallback((value: boolean) => setSignedIn(value), []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); buttonRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (pathname === "/" || pathname.startsWith("/login/")) return null;
  const roleLabel = pathname.startsWith("/provider") ? "服务方" : pathname.startsWith("/admin") ? "平台运营" : "业主";
  const label = `${roleLabel}${signedIn ? "已登录" : "未登录"}`;
  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(value => !value)}
        className="inline-flex items-center gap-2 rounded-control border border-line bg-white px-3 py-2 text-[14px] font-medium text-ink-2 hover:border-brand hover:text-brand"
      >
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${signedIn ? "bg-brand" : "bg-ink-3"}`} />
        {label}
        <span aria-hidden="true" className={`text-[11px] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute right-0 top-[calc(100%+8px)] z-30 w-[min(360px,calc(100vw-32px))] rounded-card border border-line bg-white p-4 shadow-float"
      >
        <RoleLogin onStatusChange={onStatus} />
      </div>
    </div>
  );
}
