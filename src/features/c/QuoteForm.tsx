"use client";

import React, { useEffect, useRef, useState } from "react";
import type { DemandDTO } from "@/contracts";
import {
  emptyQuoteLine, formatQuoteMoney, MAX_QUOTE_LINES, quoteUnitLabels, validateQuoteForm,
  type QuoteFormFields, type QuoteFormResult, type QuoteLineFields, type QuotePreviewData,
} from "./quote-form";

const inputClass = "mt-1 block w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:bg-slate-100";
const buttonClass = "rounded-lg border border-teal-700 px-4 py-2 text-teal-800 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";

function FieldError({ field, errors }: { field: string; errors: Record<string, string> }) {
  return errors[field] ? <p id={`quote-${field}-error`} className="mt-1 text-sm text-red-700">{errors[field]}</p> : null;
}

export function QuotePreview({ preview }: { preview: QuotePreviewData }) {
  const pendingCount = preview.items.filter((item) => item.amountCents === null).length;
  return (
    <section aria-labelledby="quote-preview-title" className="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-4 sm:p-6">
      <h3 id="quote-preview-title" className="text-lg font-semibold">本地报价预览 · 未提交</h3>
      <p className="mt-2 text-sm">来源：本页手动填写。尚未保存或发送给业主。</p>
      <p className="text-sm">预计工期：{preview.estimatedDays} 天</p>
      <ol aria-label="报价预览明细" className="space-y-3">
        {preview.items.map((item, index) => (
          <li key={item.code} className="min-w-0 rounded-lg border border-teal-100 bg-white p-4">
            <h4 className="break-words font-semibold">{index + 1}. {item.name}</h4>
            <p className="mb-1 mt-2 text-sm">
              {item.quantity} {quoteUnitLabels[item.unit]} × {item.unitPriceCents === null ? "单价待确认" : `${formatQuoteMoney(item.unitPriceCents)}/${quoteUnitLabels[item.unit]}`}
            </p>
            <p className="mb-1 font-medium">项目金额：{item.amountCents === null ? "待确认" : formatQuoteMoney(item.amountCents)}</p>
            {item.note && <p className="mb-0 whitespace-pre-wrap break-words text-sm text-slate-600">备注：{item.note}</p>}
          </li>
        ))}
      </ol>
      <p className="mb-1 mt-4 text-lg font-semibold">已知金额小计：{formatQuoteMoney(preview.knownTotalCents)}</p>
      <p className="text-sm">
        {pendingCount > 0
          ? `另有 ${pendingCount} 项费用待确认，未计入小计；当前无法确定完整总价。`
          : "当前填写的项目均有明确单价；预览金额仍需后续提交确认。"}
      </p>
      <p className="mb-0 text-sm text-slate-600">预览按每行四舍五入到分后汇总，最终计价以接口规则为准；编辑任何字段后需重新预览。</p>
    </section>
  );
}

export function QuoteForm({ demandId }: { demandId: DemandDTO["id"] }) {
  const [fields, setFields] = useState<QuoteFormFields>({ lines: [emptyQuoteLine(1)], estimatedDays: "" });
  const [result, setResult] = useState<QuoteFormResult | null>(null);
  const nextLine = useRef(2);
  const errorSummary = useRef<HTMLDivElement>(null);
  const errors = result?.kind === "invalid" ? result.errors : {};

  useEffect(() => {
    if (result?.kind === "invalid") errorSummary.current?.focus();
  }, [result]);

  function change(update: (previous: QuoteFormFields) => QuoteFormFields) {
    setFields(update);
    setResult(null);
  }

  function updateLine(code: string, patch: Partial<Omit<QuoteLineFields, "code">>) {
    change((previous) => ({ ...previous, lines: previous.lines.map((line) => line.code === code ? { ...line, ...patch } : line) }));
  }

  function addLine() {
    if (fields.lines.length >= MAX_QUOTE_LINES) return;
    const line = emptyQuoteLine(nextLine.current++);
    change((previous) => ({ ...previous, lines: [...previous.lines, line] }));
  }

  function inputA11y(field: string) {
    return { id: `quote-${field}`, "aria-invalid": Boolean(errors[field]), "aria-describedby": errors[field] ? `quote-${field}-error` : undefined };
  }

  return (
    <section className="card" aria-labelledby="quote-form-title">
      <h2 id="quote-form-title">填写报价 · 本地预览</h2>
      <p className="break-all text-sm text-slate-600">关联需求：{demandId}</p>
      <div id="quote-local-notice" className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
        <p>报价提交和接单功能待接入。当前可填写并检查报价，业主暂时无法查看。</p>
        <p className="mb-0">填写内容仅保留在当前页面内存，刷新页面、刷新详情或离开页面会丢失；本地预览不代表保存或提交。</p>
      </div>
      <form
        noValidate
        aria-label="本地报价填写"
        aria-describedby="quote-local-notice"
        onSubmit={(event) => { event.preventDefault(); setResult(validateQuoteForm(fields)); }}
      >
        {result?.kind === "invalid" && (
          <div ref={errorSummary} tabIndex={-1} role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 focus:outline focus:outline-2 focus:outline-red-700">
            <p className="font-semibold">请修正以下填写问题，再生成预览：</p>
            <ul className="list-inside list-disc text-sm">
              {Object.entries(errors).map(([field, message]) => (
                <li key={field}><a href={`#quote-${field}`} className="underline">{field.startsWith("line-") ? `项目 ${fields.lines.findIndex((line) => field.startsWith(`${line.code}-`)) + 1}：` : ""}{message}</a></li>
              ))}
            </ul>
          </div>
        )}
        <div id="quote-lines" tabIndex={-1}>
          <p className="text-sm text-slate-600">项目名称、单位、数量和预计工期必填。单价以元填写；未知费用请勾选待确认并注明原因。</p>
          {fields.lines.length === 0 && <p role="status">尚无报价项目，请添加至少一项。</p>}
          <FieldError field="lines" errors={errors} />
          {fields.lines.map((line, index) => (
            <fieldset key={line.code} className="mb-5 min-w-0 rounded-xl border border-slate-200 p-4 sm:p-5">
              <legend className="px-2 font-semibold">报价项目 {index + 1}</legend>
              <div className="mb-3 flex justify-end">
                <button type="button" onClick={() => change((previous) => ({ ...previous, lines: previous.lines.filter((item) => item.code !== line.code) }))} aria-label={`删除报价项目 ${index + 1}`} className={buttonClass}>删除项目</button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor={`quote-${line.code}-name`} className="text-sm font-medium">项目名称（必填）</label>
                  <input {...inputA11y(`${line.code}-name`)} className={inputClass} required maxLength={100} value={line.name} onChange={(event) => updateLine(line.code, { name: event.target.value })} />
                  <FieldError field={`${line.code}-name`} errors={errors} />
                </div>
                <div>
                  <label htmlFor={`quote-${line.code}-unit`} className="text-sm font-medium">计价单位（必填）</label>
                  <select {...inputA11y(`${line.code}-unit`)} className={inputClass} value={line.unit} onChange={(event) => {
                    const unit = event.target.value;
                    if (unit === "m2" || unit === "piece" || unit === "job") updateLine(line.code, { unit });
                  }}>
                    {Object.entries(quoteUnitLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <FieldError field={`${line.code}-unit`} errors={errors} />
                </div>
                <div>
                  <label htmlFor={`quote-${line.code}-quantity`} className="text-sm font-medium">数量（必填，最多三位小数）</label>
                  <input {...inputA11y(`${line.code}-quantity`)} className={inputClass} required inputMode="decimal" maxLength={32} value={line.quantity} onChange={(event) => updateLine(line.code, { quantity: event.target.value })} />
                  <FieldError field={`${line.code}-quantity`} errors={errors} />
                </div>
                <div>
                  <label htmlFor={`quote-${line.code}-priceYuan`} className="text-sm font-medium">单价（元）</label>
                  <input {...inputA11y(`${line.code}-priceYuan`)} className={inputClass} required={!line.pending} disabled={line.pending} inputMode="decimal" maxLength={32} value={line.priceYuan} onChange={(event) => updateLine(line.code, { priceYuan: event.target.value })} />
                  <FieldError field={`${line.code}-priceYuan`} errors={errors} />
                </div>
                <div className="flex items-center gap-2">
                  <input id={`quote-${line.code}-pending`} type="checkbox" className="h-4 w-4 accent-teal-700" checked={line.pending} onChange={(event) => updateLine(line.code, { pending: event.target.checked })} />
                  <label htmlFor={`quote-${line.code}-pending`} className="text-sm">费用待确认（不按零元计算）</label>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor={`quote-${line.code}-note`} className="text-sm font-medium">备注{line.pending ? "（必填，请说明待确认原因）" : "（选填）"}</label>
                  <textarea {...inputA11y(`${line.code}-note`)} className={inputClass} rows={2} required={line.pending} maxLength={1000} value={line.note} onChange={(event) => updateLine(line.code, { note: event.target.value })} />
                  <FieldError field={`${line.code}-note`} errors={errors} />
                </div>
              </div>
            </fieldset>
          ))}
        </div>
        <button type="button" className={buttonClass} disabled={fields.lines.length >= MAX_QUOTE_LINES} onClick={addLine}>添加报价项目</button>
        <span className="ml-3 text-sm text-slate-600">{fields.lines.length}/{MAX_QUOTE_LINES} 项</span>
        <div className="my-6 max-w-sm">
          <label htmlFor="quote-estimatedDays" className="text-sm font-medium">预计工期（天，必填）</label>
          <input {...inputA11y("estimatedDays")} className={inputClass} required inputMode="numeric" maxLength={16} value={fields.estimatedDays} onChange={(event) => change((previous) => ({ ...previous, estimatedDays: event.target.value }))} />
          <FieldError field="estimatedDays" errors={errors} />
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={buttonClass}>检查并预览报价</button>
          <button type="button" disabled aria-describedby="quote-submit-unavailable" className={buttonClass}>提交报价（暂未开放）</button>
        </div>
        <p id="quote-submit-unavailable" className="mb-0 mt-3 text-sm text-slate-600">提交接口尚未开放，当前不会发送报价；检查通过后仍需等待接口接入。</p>
      </form>
      <div aria-live="polite">
        {result?.kind === "preview" && <QuotePreview preview={result.preview} />}
      </div>
    </section>
  );
}
