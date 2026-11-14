# B：业主报价读取 GET 接线

日期：2026-11-14。基线：main `1b48757`，D 的 PR #76、B 的 PR #70/#77 已合入。

## 已实现

`GET /api/quote?demandId=<精确 ID>` 通过 D 的 `server-auth` 导出调用 `parseQuoteQuery` 和 `authorizeOwnerQuoteRead`，组合已有 `readStoredQuoteComparison`。没有自建参数 DTO、固定业主、前端身份信任或授权快照。凭证、当前角色、需求归属、明细读取均在内核同一 Serializable 事务中执行。

- 无参数保留固定 mock；未知参数、重复、空或纯空白 ID 返回 400。非空 ID 原样查询，不 trim，不回退 demo-demand。
- 无效/缺失/过期/撤销会话 401，当前角色不符或有效演示服务方 403。本人所有需求状态均可读取 submitted/accepted；他人和不存在统一 404，文案一致。
- 已有需求无可比报价为 200 空数组；内核返回 null 也映射为上述 404。JSON、DTO、金额溢出、错位结果、数据库异常均为 503，不部分返回、不变成空成功或 mock。
- 成功返回公共 `envelope(Quote[])`，金额逐行重算，null 与零元分别保留；稳定 ID 顺序不表示最新版本、价格或质量排名。
- 路由 `force-dynamic`；成功、失败及无参数演示响应均使用 D 的 `Cache-Control: private, no-store` 和 `Vary: Cookie`。

本次只完成 GET API，不修改 POST 或 PR #74 的测试；页面仍调用无参数演示 GET，后续单独切换显式查询并处理业主认证失败。未修改 D/C/A 文件、公共契约、配置、依赖、.env 或开发数据库；仅生成已合入 schema 对应的 Prisma Client。

## 测试与限制

`tests/B-quote-read-api.test.ts` 在设置临时 DATABASE_URL 后加载默认公开 GET，不注入授权器。仅在测试中通过 D 内部签发函数为合成账户准备随机会话，读取使用实际数据库会话和授权实现。测试包含原子内核写入后重连，GET 读回同一 ID/金额/null、所有需求状态、跨业主隔离、精确 ID、会话变化、事务内撤销与回滚、数据损坏和故障映射。测试签发不代表密码或外部身份验证已实现，没有生成生产业主凭证或新增签发接口。

业主登录/注销入口仍未实现，当前浏览器没有正常取得业主会话的入口，匿名显式 GET 应返回 401。未进行浏览器登录闭环验收。无参数报价和服务方资料仍为 mock；临时 SQLite 的合成非演示需求按现行协议标 live，不能当作真实客户数据。

定向命令：`node node_modules/tsx/dist/cli.mjs --test tests/B-quote-read-api.test.ts tests/B-quote-read.test.ts tests/B-quote.test.ts`，30/30 通过。`npm run check` 通过（438/438 测试、lint 无警告、类型与导入边界通过）；`npm run build` 通过；`npm run scope -- --role B --base origin/main` 通过（7 个 B 文件）；`git diff --check` 通过。

## D 的文档和来源后续

请 D 在合入时同步 `docs/API.md`、`D-owner-quote-read-auth.md` 中“GET 尚未接线”状态：API 已按上述规则开放，页面与业主登录入口仍待实现。PR #74 的测试修复继续由 D 处理，本次不修改。

本次按 D 已冻结协议沿用需求来源，没有擅改公共 Quote。此前 `B-quote-demo-session.md` 提出的报价持久化来源问题仍存在：演示服务方对 live 需求写入的报价，未来读取会随 demand.source 标 live。请 D 统一交付来源持久化/历史回填与聚合规则（例如服务端决定 Quote.source，历史不明记录默认 mock，混合报价整体 mock）；字段是否公开、空列表来源及写入适配也需一并冻结。当前来源只反映需求来源，不能用于证明报价提交者是真实认证用户。生产使用前必须解决；本次不把已有演示写入或合成测试声称为真实报价来源。
