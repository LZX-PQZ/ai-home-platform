"use client";

import { useEffect } from "react";
import { Button, LinkButton } from "@/components/ui";

/** 页面渲染出错时的兜底页：说明发生了什么、怎么恢复；不展示内部错误详情。 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section aria-labelledby="error-title" role="alert" className="max-w-[38em] py-10 md:py-16">
      <h1 id="error-title" className="!mb-3">这一页没能显示出来</h1>
      <p className="text-[17px] text-ink-2">
        页面在显示时出错了。点“重新显示”会再试一次，不会重复提交你之前的操作；如果反复出现，请把下面的错误编号发给维护者。
      </p>
      {error.digest ? <p className="text-[14px] text-ink-3">错误编号：<span className="num">{error.digest}</span></p> : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={reset}>重新显示</Button>
        <LinkButton href="/" variant="secondary">回到首页</LinkButton>
      </div>
    </section>
  );
}
