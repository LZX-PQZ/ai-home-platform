import { randomBytes } from "node:crypto";
import { closeSync, openSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { provisionRoadshowAccounts } from "../src/lib/roadshow-accounts";

async function main() {
  if (process.argv.length !== 2) throw new Error("No credentials in command arguments");
  loadEnvConfig(process.cwd());
  const output = resolve(".env.roadshow-accounts.txt");
  // Exclusive file creation prevents overwriting an existing credential handoff.
  const file = openSync(output, "wx", 0o600);
  const db = new PrismaClient();
  let committed = false;
  try {
    const passwords = { owner: randomBytes(18).toString("base64url"), provider: randomBytes(18).toString("base64url"), admin: randomBytes(18).toString("base64url") };
    writeFileSync(file, ["仅本机路演使用；不要提交、公开展示或写入 PR。", `数据库：${process.env.DATABASE_URL ?? "未配置"}`,
      "业主：roadshow.owner", `密码：${passwords.owner}`, "服务方：roadshow.provider", `密码：${passwords.provider}`,
      "平台运营：roadshow.admin", `密码：${passwords.admin}`, ""].join("\n"), "utf8");
    await provisionRoadshowAccounts(db, passwords);
    committed = true;
    console.log(`三端账号已开通。密码仅写入本机文件：${output}`);
  } finally {
    closeSync(file);
    if (!committed) unlinkSync(output);
    await db.$disconnect();
  }
}
main().catch(() => { console.error("未开通路演账号。请检查数据库是否已同步、种子账号绑定及账号/交付文件是否已存在；不会覆盖原账号密码。"); process.exitCode = 1; });
