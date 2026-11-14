import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

const quoteInfrastructure = ["src/lib/idempotency.ts", "src/lib/quote-policy.ts", "src/lib/server-auth.ts"];

test("演示会话内部实现只由 D 服务端读取，报价通过 server-auth 使用适配器", () => {
  for (const target of ["src/lib/demo-provider-session.ts", "src/lib/demo-session-handlers.ts"]) {
    assert.equal(canReadAcrossOwner("src/lib/server-auth.ts", target), true);
    assert.equal(canReadAcrossOwner("src/app/api/auth/demo-provider/route.ts", target), true);
    assert.equal(canReadAcrossOwner("src/lib/server-auth.ts", target, true), false);
    for (const file of ["src/components/ui/DemoProviderLogin.tsx", "src/features/c/quote-submit.ts", "src/lib/quote-engine/transaction.ts"]) {
      assert.equal(canReadAcrossOwner(file, target), false);
    }
  }
});

test("报价服务端可导入幂等与授权工具，其他业务和共享 UI 不获得同样权限", () => {
  for (const target of quoteInfrastructure) {
    for (const file of ["src/app/api/quote/route.ts", "src/lib/quote-engine.ts", "src/lib/quote-engine/transaction.ts", "src/lib/d-quote-service.ts"]) {
      assert.equal(canReadAcrossOwner(file, target), true, `${file} -> ${target}`);
      assert.equal(canReadAcrossOwner(file, target, true), false, `客户端可达：${file} -> ${target}`);
    }
    for (const file of [
      "src/app/owner/quotes/[id]/page.tsx", "src/components/QuoteTable.tsx",
      "src/features/b/load-quotes.ts", "src/features/c/quote-submit.ts",
      "src/app/api/match/route.ts", "src/lib/match/data.ts",
      "src/components/ui/button.tsx", "src/app/layout.tsx", "src/lib/quote-engine.private.ts",
    ]) assert.equal(canReadAcrossOwner(file, target), false, `${file} -> ${target}`);
  }
});

test("扫描器拦截客户端经导入、重导出和动态导入间接访问报价服务端工具", () => {
  const root = mkdtempSync(path.join(tmpdir(), "d-quote-boundaries-"));
  const script = fileURLToPath(new URL("../scripts/check-boundaries.mjs", import.meta.url));
  const put = (file: string, source: string) => {
    const target = path.join(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, source);
  };
  const scan = () => execFileSync(process.execPath, [script], { cwd: root, encoding: "utf8", stdio: "pipe" });
  try {
    for (const target of quoteInfrastructure) put(target, "export const value = 1;");
    const client = "src/features/b/client.tsx";
    const bridge = "src/lib/quote-engine/bridge.ts";
    for (const target of quoteInfrastructure) {
      const specifier = `@/${target.slice(4, -3)}`;
      for (const statement of [
        `import { value } from '${specifier}';`,
        `export { value } from '${specifier}';`,
        `export const load = () => import('${specifier}');`,
      ]) {
        put(client, "export {};");
        put(bridge, statement);
        assert.match(scan(), /边界检查通过/);
        put(client, "'use client'; export { value } from '@/lib/quote-engine/bridge';");
        assert.throws(scan, (error: unknown) => {
          assert.ok(error instanceof Error && "stderr" in error);
          assert.match(String(error.stderr), new RegExp(`bridge\\.ts -> ${target.replaceAll(".", "\\.")}`));
          return true;
        });
        put(client, "export {};");
        put(bridge, `'use client'; ${statement}`);
        assert.throws(scan);
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
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
