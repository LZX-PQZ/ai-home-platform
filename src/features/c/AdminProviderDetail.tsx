"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { ProviderDTO } from "@/contracts";
import { StatusBadge } from "@/components/StatusBadge";
import { Button, C, Empty } from "@/components/ui";
import { adminProviderDetailFailureState, loadAdminProviderDetail, providerKindLabels, type AdminProviderDetailState } from "./admin-provider-detail";

const linkClass = "rounded-md text-sm font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export function AdminProviderDetailContent({ providerId, state, onReload }: {
  providerId: ProviderDTO["id"];
  state: AdminProviderDetailState;
  onReload: () => void;
}) {
  const result = state.status === "ready" ? state.result : null;
  const provider = result?.provider;
  const tags = provider?.tags.filter(tag => tag.trim().length > 0) ?? [];

  return (
    <section aria-labelledby="admin-provider-title" className="space-y-6">
      <nav aria-label="管理端返回导航">
        <Link href="/admin/tickets" className={linkClass}>返回售后工单</Link>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 id="admin-provider-title" className={C.pageTitle}>服务方资料</h1>
          <p className={`${C.pageSub} break-all`}>服务方编号：{providerId}</p>
        </div>
        <Button onClick={onReload} variant="secondary" disabled={state.status === "loading"}
          className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          {state.status === "loading" ? "正在加载…" : state.status === "error" ? "重新加载" : "刷新资料"}
        </Button>
      </div>
      <div className={`${C.note} ${C.noteWarn}`}>
        <p>本页仅查看公开服务方资料，角色导航不代表登录鉴权。资料用于识别工单关联对象，不代表已核实责任、资质或履约能力。</p>
        <p className="!mb-0">资料与工单分别查询，来源可能不同。查看资料不会派单、变更责任方或修改工单状态。</p>
      </div>

      {state.status === "loading" && <div className={C.card} role="status" aria-live="polite">正在读取服务方资料，请稍候…</div>}
      {state.status === "error" && (
        <div className={`${C.card} border-danger/30`} role="alert">
          <h2>暂时无法加载服务方资料</h2>
          <p className="!mb-0">{state.message}</p>
        </div>
      )}
      {result && (
        <>
          <div role="status" aria-live="polite">
            <StatusBadge label={result.source === "mock" ? "资料查询来源：模拟标识（mock）" : "资料查询来源：实时接口（live）"} />
            <p className={`${C.pageSub} mt-2 !mb-0`}>
              {result.source === "mock"
                ? "本次服务方列表为模拟来源，资料仅供演示，不代表真实机构或认证结果。"
                : "本次服务方列表由实时接口返回，来源标识不代表已认证或已核实资料。"}
            </p>
          </div>
          {provider ? (
            <article aria-labelledby="admin-provider-name" className={`${C.card} min-w-0`}>
              <h2 id="admin-provider-name" className={`${C.sectionTitle} whitespace-pre-wrap break-words [overflow-wrap:anywhere]`}>
                {provider.name.trim() ? provider.name : "名称未填写"}
              </h2>
              <dl className="mt-4 grid gap-6 sm:grid-cols-2">
                <div className="min-w-0"><dt className={C.meta}>所在城市</dt><dd className="mt-1 break-words [overflow-wrap:anywhere]">{provider.city.trim() ? provider.city : "城市未填写"}</dd></div>
                <div><dt className={C.meta}>服务类型</dt><dd className="mt-1">{providerKindLabels[provider.kind]}</dd></div>
                <div className="min-w-0 sm:col-span-2">
                  <dt className={C.meta}>资料标签</dt>
                  <dd className="mt-2">
                    {tags.length > 0 ? <ul aria-label="服务方资料标签" className="flex flex-wrap gap-2">
                      {tags.map((tag, index) => <li key={index} className={`${C.badge} ${C.badgeNeutral} min-w-0 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere]`}>{tag}</li>)}
                    </ul> : "暂未提供标签"}
                  </dd>
                </div>
              </dl>
            </article>
          ) : (
            <div role="status" aria-live="polite">
              <Empty title="本次列表未找到该服务方资料" hint="该编号未出现在本次返回的资料列表中，不能据此认定服务方不存在或已解除工单责任。可返回售后工单核对编号，或刷新资料重试。" />
            </div>
          )}
        </>
      )}
    </section>
  );
}

function AdminProviderDetailLoader({ providerId }: { providerId: ProviderDTO["id"] }) {
  const [state, setState] = useState<AdminProviderDetailState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let active = true;
    loadAdminProviderDetail(providerId).then(
      result => { if (active) setState({ status: "ready", result }); },
      (error: unknown) => { if (active) setState(adminProviderDetailFailureState(error)); },
    );
    return () => { active = false; };
  }, [providerId, reloadKey]);

  function reload() {
    setState({ status: "loading" });
    setReloadKey(previous => previous + 1);
  }
  return <AdminProviderDetailContent providerId={providerId} state={state} onReload={reload} />;
}

export function AdminProviderDetail({ providerId }: { providerId: ProviderDTO["id"] }) {
  // Reset immediately when navigating between IDs; ignore results after unmount.
  return <AdminProviderDetailLoader key={providerId} providerId={providerId} />;
}
