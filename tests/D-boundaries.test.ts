import test from "node:test";
import assert from "node:assert/strict";
import { canReadAcrossOwner } from "../scripts/check-boundaries.mjs";

test("报价服务端 API 和引擎可以读取服务端身份基础设施", () => {
  for (const file of [
    "src/app/api/quote/route.ts",
    "src/lib/quote-engine.ts",
    "src/lib/quote-engine/submit-request.ts",
  ]) {
    assert.equal(canReadAcrossOwner(file, "src/lib/server-auth.ts"), true, file);
  }
});

test("页面、组件和其他业务路径不能读取服务端身份基础设施", () => {
  for (const file of [
    "src/app/owner/quotes/[id]/page.tsx",
    "src/features/b/load-quotes.ts",
    "src/app/owner/demand/chat/page.tsx",
  ]) {
    assert.equal(canReadAcrossOwner(file, "src/lib/server-auth.ts"), false, file);
  }
});
