"use client";

import { useState } from "react";
import { DemandDraftPanel } from "@/features/a/DemandDraftPanel";
import { useDemandChat } from "@/features/a/useDemandChat";

const QUICK_PHRASES = [
  "深圳 60 平老房，给老人住，卫生间太滑，想加扶手",
  "厨房漏水，橱柜底板发霉，预算 1 万左右",
];

export function ChatWindow() {
  const { messages, phase, error, result, source, canRetry, send, retry, reset } = useDemandChat();
  const [text, setText] = useState("");
  const sending = phase === "sending";

  const submit = async () => {
    if (sending) return;
    const value = text;
    setText("");
    await send(value);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="!mb-0">AI 需求澄清</h2>
          <span className="badge">对话接口来源：{source ?? "未确认"}</span>
        </div>
        <p className="text-xs text-slate-500">
          当前为 mock 澄清接口，不调用真实模型，也不会自动补全您没说过的信息。
        </p>

        <ol
          className="mt-3 grid max-h-[420px] gap-2 overflow-y-auto rounded-xl bg-slate-50 p-3"
          aria-live="polite"
        >
          {messages.map((message, index) => (
            <li
              key={`${message.role}-${index}`}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[85%] rounded-xl bg-teal-700 px-3 py-2 text-sm text-white"
                  : "mr-auto max-w-[85%] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
              }
            >
              <span className="block text-[11px] opacity-70">
                {message.role === "user" ? "我" : "需求澄清助手"}
              </span>
              {message.content}
            </li>
          ))}
          {sending && (
            <li className="mr-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
              助手正在整理需求…
            </li>
          )}
        </ol>

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
            <p className="!mb-2">{error}</p>
            <div className="flex gap-2">
              {canRetry && (
                <button
                  type="button"
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm"
                  onClick={retry}
                  disabled={sending}
                >
                  重试上一次请求
                </button>
              )}
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                onClick={reset}
              >
                重新开始
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_PHRASES.map((phrase) => (
            <button
              key={phrase}
              type="button"
              className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700"
              onClick={() => setText(phrase)}
              disabled={sending}
            >
              {phrase}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-2">
          <textarea
            className="min-h-[76px] w-full rounded-lg border border-slate-300 p-2 text-sm"
            placeholder="例如：深圳 60 平老房，给老人住，卫生间太滑，预算 3-5 万，一个月内完工"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            disabled={sending}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => void submit()}
              disabled={sending || text.trim().length === 0}
            >
              {sending ? "发送中…" : "发送"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              onClick={reset}
              disabled={sending}
            >
              清空对话
            </button>
            <span className="text-xs text-slate-500">Enter 发送，Shift+Enter 换行</span>
          </div>
        </div>
      </section>

      <DemandDraftPanel result={result} source={source} />
    </div>
  );
}
