"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { StaffLoginInput, StaffSessionState, type OwnerLoginInputDTO, type StaffRoleDTO, type StaffSessionStateDTO } from "@/contracts";
import { apiDelete, apiGet, apiPost, ApiClientError } from "@/lib/api-client";
import { Button, C } from "@/components/ui";

export function StaffLogin({ role, onStatusChange }: { role: StaffRoleDTO; onStatusChange?: (signedIn: boolean) => void }) {
  const pathname = usePathname();
  const label = role === "provider" ? "服务方" : "平台运营";
  const home = role === "provider" ? "/provider" : "/admin";
  const [session, setSession] = useState<StaffSessionStateDTO | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const control = useRef({ active: true, busy: false, version: 0 });
  const enter = useCallback(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    // Only a path within this role can be resumed; never accept an external redirect.
    const target = next && !next.includes("\\") && (next === home || next.startsWith(`${home}/`) || next.startsWith(`${home}?`)) ? next : home;
    // A new password session must discard pages prefetched under the old role.
    window.location.replace(target);
  }, [home]);
  const run = useCallback(async (method: "GET" | "POST" | "DELETE", input?: OwnerLoginInputDTO) => {
    const request = control.current;
    if (request.busy) return;
    request.busy = true;
    const version = ++request.version;
    setPending(true); setError(null); setSession(null);
    try {
      const endpoint = `/api/auth/${role}`;
      const result = method === "GET" ? await apiGet(endpoint, StaffSessionState)
        : method === "POST" ? await apiPost(endpoint, StaffLoginInput.parse(input), StaffSessionState)
          : await apiDelete(endpoint, StaffSessionState);
      const source = "meta" in result ? result.meta.source : result.source;
      if (source !== "live" || (result.data.status === "signed_in" && result.data.identity.role !== role)
        || (method === "POST" && result.data.status !== "signed_in") || (method === "DELETE" && result.data.status !== "signed_out")) {
        throw new Error("Invalid session response");
      }
      if (!request.active || request.version !== version) return;
      setSession(result.data);
      if (method === "POST") enter();
      if (method === "DELETE" || (method === "GET" && result.data.status === "signed_out" && !pathname.startsWith("/login/"))) {
        window.location.replace(`/login/${role}`);
      }
    } catch (failure) {
      if (!request.active || request.version !== version) return;
      setError(failure instanceof ApiClientError && failure.status === 401 ? "账号、密码或所选登录端不正确。"
        : failure instanceof ApiClientError && failure.status === 429 ? "尝试过于频繁，请稍后重试。" : "暂时无法确认登录状态，请重试。");
    } finally { if (request.version === version) { request.busy = false; if (request.active) setPending(false); } }
  }, [role, enter, pathname]);
  useEffect(() => {
    const request = control.current;
    request.active = true;
    const refresh = () => { void run("GET"); };
    refresh(); window.addEventListener("focus", refresh);
    return () => { request.active = false; request.busy = false; request.version++; window.removeEventListener("focus", refresh); };
  }, [run]);
  useEffect(() => {
    if (session?.status !== "signed_in") return;
    const timer = setTimeout(() => { void run("GET"); }, Math.max(1000, Date.parse(session.expiresAt) - Date.now() + 50));
    return () => clearTimeout(timer);
  }, [session, run]);
  const signedIn = !pending && !error && session?.status === "signed_in";
  useEffect(() => { onStatusChange?.(Boolean(signedIn)); }, [signedIn, onStatusChange]);
  return <section aria-label={`${label}账号登录`}>
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><strong>{label}账号</strong><p role="status" className="mt-1 text-sm text-ink-2">
          {pending ? "正在确认登录状态…" : signedIn ? `已登录${label}账号` : error ? "登录状态未确认" : `请登录${label}账号`}</p></div>
        <div className="flex gap-2">
          {signedIn && <Button variant="secondary" onClick={() => { void run("DELETE"); }}>退出{label}登录</Button>}
          {signedIn && pathname.startsWith("/login/") && <Button onClick={enter}>进入{label}首页</Button>}
          <Button variant="ghost" disabled={pending} onClick={() => { void run("GET"); }}>刷新登录状态</Button>
        </div>
      </div>
      {!signedIn && <form aria-label={`${label}登录表单`} className="grid gap-3" onSubmit={event => {
        event.preventDefault(); const parsed = StaffLoginInput.safeParse({ login, password }); setPassword("");
        if (!parsed.success) { setError("请输入有效账号和至少 15 位密码。"); return; }
        void run("POST", parsed.data);
      }}>
        <label className={C.label}><span className={C.labelText}>账号</span><input className={C.input} autoComplete="username" required
          minLength={3} maxLength={64} disabled={pending} value={login} onChange={event => setLogin(event.target.value)} /></label>
        <label className={C.label}><span className={C.labelText}>密码</span><input className={C.input} type="password" autoComplete="current-password" required
          minLength={15} maxLength={128} disabled={pending} value={password} onChange={event => setPassword(event.target.value)} /></label>
        <Button type="submit" disabled={pending}>登录{label}账号</Button>
      </form>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {!signedIn && <p className="text-sm text-ink-2">请使用演示负责人提供的{label}账号；业主账号不能用于此端登录。暂未开放注册。</p>}
    </div>
  </section>;
}
