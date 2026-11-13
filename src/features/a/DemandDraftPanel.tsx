"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ChatResultDTO } from "@/contracts";
import {
  RENOVATION_OPTIONS,
  demandPath,
  fieldLabel,
  formFromDraft,
  formToInput,
  interpretDemandSubmit,
  renovationLabel,
  type DemandForm,
  type EnvelopeSource,
  type SubmitOutcome,
} from "./demand-chat";

type Props = {
  result: ChatResultDTO | null;
  source: EnvelopeSource | null;
};

/**
 * 结构化需求单：展示对话产出的草稿，允许人工修正后确认提交。
 * 草稿来自 mock 时明确标注；提交返回 501 时只显示“尚未开放”，不制造成功态。
 */
export function DemandDraftPanel({ result, source }: Props) {
  const draft = result?.draft ?? null;
  const [form, setForm] = useState<DemandForm>(() => formFromDraft(draft));
  const [manual, setManual] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  useEffect(() => {
    if (draft) {
      setForm(formFromDraft(draft));
      setManual(false);
    }
  }, [draft]);

  const update = <K extends keyof DemandForm>(key: K, value: DemandForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    const checked = formToInput(form);
    if (!checked.ok) {
      setFormErrors(checked.messages);
      setOutcome(null);
      return;
    }
    setFormErrors([]);
    setSubmitting(true);
    setOutcome(null);
    try {
      const response = await fetch("/api/demand", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(checked.value),
      });
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      setOutcome(interpretDemandSubmit(response.status, payload));
    } catch (cause) {
      setOutcome({
        kind: "failed",
        message: cause instanceof Error ? cause.message : "网络异常，需求未提交。",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const created = outcome?.kind === "created" ? outcome.demand : null;

  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="!mb-0">结构化需求单</h2>
        <span className="badge">
          {draft ? `草稿来源：${source ?? "未知"}` : "尚无 AI 草稿"}
        </span>
      </div>

      {result === null && (
        <p className="text-sm text-slate-600">
          先在左侧发一句话描述需求。对话接口返回草稿后，这里会列出字段；当前对话接口为 mock，
          可能不会给出草稿，此时可以手动填写并验证提交流程。
        </p>
      )}

      {result && result.missingFields.length > 0 && (
        <div className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p className="!mb-1 font-semibold">还缺这些信息</p>
          <ul className="list-disc pl-5">
            {result.missingFields.map((field) => (
              <li key={field}>{fieldLabel(field)}</li>
            ))}
          </ul>
        </div>
      )}

      {result && result.ready && draft && (
        <p className="text-sm text-emerald-800">
          对话接口认为信息已齐全。请核对下面字段后再确认提交，提交前不会写入任何数据。
        </p>
      )}

      {result && !draft && (
        <button
          type="button"
          className="mb-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          onClick={() => setManual((value) => !value)}
        >
          {manual ? "收起手动填写" : "手动填写需求单（不是 AI 生成）"}
        </button>
      )}

      {(draft || manual) && (
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">需求描述</span>
            <textarea
              className="min-h-[72px] rounded-lg border border-slate-300 p-2"
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">城市</span>
              <input
                className="rounded-lg border border-slate-300 p-2"
                value={form.city}
                onChange={(event) => update("city", event.target.value)}
                placeholder="例如：深圳"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">面积（㎡）</span>
              <input
                className="rounded-lg border border-slate-300 p-2"
                inputMode="decimal"
                value={form.areaM2}
                onChange={(event) => update("areaM2", event.target.value)}
                placeholder="例如：60"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">预算下限（元）</span>
              <input
                className="rounded-lg border border-slate-300 p-2"
                inputMode="decimal"
                value={form.budgetMinYuan}
                onChange={(event) => update("budgetMinYuan", event.target.value)}
                placeholder="例如：30000"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">预算上限（元）</span>
              <input
                className="rounded-lg border border-slate-300 p-2"
                inputMode="decimal"
                value={form.budgetMaxYuan}
                onChange={(event) => update("budgetMaxYuan", event.target.value)}
                placeholder="例如：50000"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">改造类型</span>
              <select
                className="rounded-lg border border-slate-300 p-2"
                value={form.renovationType}
                onChange={(event) =>
                  update("renovationType", event.target.value as DemandForm["renovationType"])
                }
              >
                {RENOVATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">期望工期（天）</span>
              <input
                className="rounded-lg border border-slate-300 p-2"
                inputMode="numeric"
                value={form.desiredDays}
                onChange={(event) => update("desiredDays", event.target.value)}
                placeholder="例如：30"
              />
            </label>
          </div>
          <p className="text-xs text-slate-500">
            金额按「元」填写，提交时换算为「分」并取整；预算下限不能大于上限。当前类型：
            {renovationLabel(form.renovationType)}。
          </p>
          <div>
            <button
              type="button"
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? "提交中…" : "确认并提交需求"}
            </button>
          </div>
        </div>
      )}

      {formErrors.length > 0 && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          <p className="!mb-1 font-semibold">表单校验未通过</p>
          <ul className="list-disc pl-5">
            {formErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {outcome?.kind === "not_implemented" && (
        <div className="mt-3 rounded-lg bg-slate-100 p-3 text-sm text-slate-700" role="status">
          <p className="!mb-1 font-semibold">需求保存尚未开放</p>
          <p className="!mb-0">{outcome.message}</p>
          <p className="!mb-0 text-xs text-slate-500">
            这条需求没有保存，也没有生成需求 ID；等 D 实现 POST /api/demand 后再重试。
          </p>
        </div>
      )}

      {outcome?.kind === "rejected" && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          <p className="!mb-1 font-semibold">接口拒绝了这份需求</p>
          <ul className="list-disc pl-5">
            {outcome.messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {outcome?.kind === "failed" && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          提交失败：{outcome.message}
        </div>
      )}

      {created && (
        <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
          <p className="!mb-1 font-semibold">
            需求已创建（来源：{outcome?.kind === "created" ? outcome.source : "未知"}）
          </p>
          <p className="!mb-0">
            需求 ID：<code>{created.id}</code> · 状态：{created.status}
          </p>
          <p className="!mb-0">
            <Link href={demandPath(created.id)}>打开需求详情 →</Link>
          </p>
        </div>
      )}
    </section>
  );
}
