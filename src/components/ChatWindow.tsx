"use client";

import { useState } from "react";
import { DemandDraftPanel } from "@/features/a/DemandDraftPanel";
import { useDemandChat } from "@/features/a/useDemandChat";
import { normalizeOutgoing, sourceLabel } from "@/features/a/demand-chat";
import { Badge, Button, C, Card, Note, SectionHead } from "@/features/a/ui";

const QUICK_PHRASES = [
  "深圳 60 平老房，给老人住，卫生间太滑，想加扶手",
  "厨房漏水，橱柜底板发霉，预算 1 万左右",
];

/** 头像：让对话看起来像两个人的往来，而不是两条文本 */
function Avatar({ me }: { me: boolean }) {
  return (
    <span
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11.5px] font-semibold ${
        me ? "bg-[#E7F3EF] text-[#0C5A47]" : "bg-[#FDF0E2] text-[#8A5A06]"
      }`}
      aria-hidden
    >
      {me ? "我" : "AI"}
    </span>
  );
}

export function ChatWindow() {
  const { messages, phase, error, result, source, canRetry, send, retry, reset } = useDemandChat();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [session, setSession] = useState(0);
  const sending = phase === "sending";
  const busy = sending || saving;

  const restart = () => {
    if (busy) return;
    reset();
    setText("");
    setSession((current) => current + 1);
  };

  const submit = async () => {
    if (busy) return;
    const value = text;
    if (normalizeOutgoing(value).ok) setText("");
    await send(value);
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
      <Card>
        <SectionHead
          title="AI 需求澄清"
          aside={
            <Badge tone={source === "live" ? "brand" : "accent"}>
              结果来源：{sourceLabel(source)}
            </Badge>
          }
        />
        <p className={`!mb-0 ${C.meta}`}>
          请描述房屋情况和改造目标，并核对返回的需求单。模拟模式只展示固定追问，不会识别您已提供的信息；也可直接手动填写。
        </p>

        <ol
          className="mt-3.5 grid max-h-[440px] gap-3 overflow-y-auto rounded-[12px] bg-[#F7FAFA] p-3.5"
          aria-live="polite"
        >
          {messages.map((message, index) => {
            const me = message.role === "user";
            return (
              <li key={`${message.role}-${index}`} className="flex items-start gap-2.5">
                <Avatar me={me} />
                <div
                  className={
                    me
                      ? "max-w-[84%] rounded-[12px] rounded-tl-[4px] bg-[#0F6E56] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white"
                      : "max-w-[84%] rounded-[12px] rounded-tl-[4px] border border-[#E2E9EB] bg-white px-3.5 py-2.5 text-[13.5px] leading-relaxed text-[#16242B]"
                  }
                >
                  <span
                    className={`mb-1 block text-[11px] ${me ? "text-white/65" : "text-[#7A8A90]"}`}
                  >
                    {me ? "我" : "需求澄清助手"}
                  </span>
                  {message.content}
                </div>
              </li>
            );
          })}
          {sending && (
            <li className="flex items-start gap-2.5">
              <Avatar me={false} />
              <div className="rounded-[12px] rounded-tl-[4px] border border-[#E2E9EB] bg-white px-3.5 py-2.5 text-[13.5px] text-[#7A8A90]">
                助手正在整理需求…
              </div>
            </li>
          )}
        </ol>

        {error && (
          <div className="mt-3">
            <Note tone="danger" title="对话请求失败">
              <p>{error}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {canRetry && (
                  <Button variant="danger" size="sm" onClick={retry} disabled={busy}>
                    重试上一次请求
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={restart} disabled={busy}>
                  重新开始
                </Button>
              </div>
            </Note>
          </div>
        )}

        <div className="mt-3.5 flex flex-wrap gap-2">
          {QUICK_PHRASES.map((phrase) => (
            <button
              key={phrase}
              type="button"
              className={C.pill}
              onClick={() => setText(phrase)}
              disabled={busy}
            >
              {phrase}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-2.5">
          <textarea
            aria-label="需求描述消息"
            className={`min-h-[84px] resize-y ${C.input}`}
            placeholder="用一句话说说房子的情况和您想怎么改，例如：深圳 60 平老房，给老人住，卫生间太滑，预算 3-5 万，一个月内完工"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                event.preventDefault();
                void submit();
              }
            }}
            disabled={busy}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void submit()} disabled={busy || text.trim().length === 0}>
              {sending ? "发送中…" : "发送"}
            </Button>
            <Button variant="secondary" onClick={restart} disabled={busy}>
              清空对话
            </Button>
            <span className={C.meta}>Enter 发送，Shift+Enter 换行</span>
          </div>
        </div>
      </Card>

      <DemandDraftPanel key={session} result={result} source={source} onSubmittingChange={setSaving} />
    </div>
  );
}
