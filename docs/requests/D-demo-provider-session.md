# D：固定服务方的演示登录与事务会话

日期：2026-11-14 · 同步基线：main 94f83a0 · 状态：已实现演示登录，待合入后由 B 接入报价处理器的会话参数

## 原因与边界

报价的默认会话读取器总是返回 null，无法演示登录后流程。新增显式开启的演示登录：只使用服务端预设的 `demo-provider-account` → `provider-a`，不接受客户端 userId、role 或 providerId。它不是实名、密码或生产登录。角色导航不产生会话。

## 公共协议与配置

- 服务端 `DEMO_AUTH_ENABLED=true` 才开放；默认关闭。关闭期间 reader 拒绝所有演示 cookie。
- `POST /api/auth/demo-provider`：输入 `DemoProviderLoginInput`，仅 `{ action: "login_demo" }`；成功返回 `envelope(DemoProviderSession)` 并设置 HttpOnly、SameSite=Strict、Path=/ 的 cookie，HTTPS 使用 Secure。响应一律 `meta.source: mock`。
- `GET`：返回 `disabled`、`signed_out` 或 `signed_in`；登录态包含固定服务方身份与 expiresAt，均明确 demo 标识。响应不缓存，不返回令牌。
- `DELETE`：同源退出，删除数据库会话并清除 cookie，关闭模式时仍允许撤销。POST/DELETE 的 Origin 必须与请求协议及 Host 一致，兼容 NextURL 对 loopback 的规范化，不信任转发主机头；跨站和缺少 Origin 返回 403。登录坏输入返回 400，登录未开启返回 403，账号未准备/数据库异常返回 503。
- Cookie 是服务端生成的 256 位随机不透明令牌，数据库仅存 SHA-256 摘要，30 分钟绝对过期；重新登录轮换并撤销当前会话。持久化支持进程重启后读取，不依赖内存 Map 或浏览器存储。
- Prisma 增加 DemoProviderSession，保存摘要、userId、绑定 providerId、createdAt、expiresAt。种子增加固定账号，不覆盖既有账号/绑定。

## B 的接入

`requireProviderIdentity(request)` 的默认 reader 接入演示 cookie；未开启或无有效 cookie 仍返回 401。`server-auth.ts` 同时导出 `readDemoVerifiedSession(request, tx)`，可直接作为报价事务的 reader：必须传入当前 tx，重新检查会话存在、过期、账户角色和绑定。换绑、删除、退出后的会话不可重放。

PR #67 已将报价 POST 处理器连接到原子幂等内核，但处理器的两个默认会话参数仍显式使用 `noVerifiedSession`。这会覆盖 `requireProviderIdentity` 自身的默认 reader，所以即使演示 cookie 有效，公开 POST 仍返回 `401 UNAUTHENTICATED`，不写入报价或回执。

B 后续需在服务端调用处把 `readDemoVerifiedSession` 同时传给 `QuoteSubmissionAuth.readSession` 与 `readTransactionSession`，后者必须使用内核传入的当前 tx；还需把演示身份的成功回执标为 mock，不能沿用当前处理器固定的 live 来源。本次不修改 B 的路由/内核。数据库落库不等于真实身份验证，不能将演示登录说成真实账号认证。报价读取规则见 `D-quote-read-protocol.md`；业主认证与公开 GET 接线仍未实现。

`server-auth.ts` 及演示会话实现纳入客户端传递导入检查。B 仅通过已有 server-auth 服务端入口使用适配器；UI 只调用公共 HTTP 接口。

## 验收

全局入口明确“演示服务方登录”；登录、刷新、过期和退出后的 UI 反映接口状态。隔离 SQLite 验证登录令牌不明文落库、失效/伪造/换绑拒绝、同事务可见及现有报价内核可用。所有合成测试数据只进入临时数据库；不得提交 .env、数据库或令牌。
