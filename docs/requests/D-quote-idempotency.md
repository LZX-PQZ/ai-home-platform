# D：报价幂等、事务身份与写入授权决策

发起人：D · 日期：2026-11-14 · 关联：`docs/requests/B-quote-idempotency.md`

本文件冻结 B 接通真实报价写入前必须遵守的共享协议。当前公开 `POST /api/quote` 仍按 `docs/API.md` 的认证优先级返回 401/403/501；本次不开放真实写入。

## 幂等键与回执

- `POST /api/quote` 写入开放后必须携带 `Idempotency-Key` 请求头。值使用公共 `IdempotencyKey` 校验：16–128 位 ASCII 字母、数字、`-` 或 `_`；缺失或非法返回 400。请求体不增加幂等字段。
- `src/lib/api-client.ts` 的 `apiPost` 支持可选 `headers`，调用方在一次提交和不确定结果的重试中复用同一键；修改输入后必须生成新键。
- Prisma 新增 `QuoteSubmissionReceipt`，保存 `providerId`、`idempotencyKey`、`requestHash`、`quoteId`、`createdAt`；`(providerId, idempotencyKey)` 唯一，`quoteId` 唯一并关联 `Quote`。回执和报价必须在同一 Serializable 事务中提交。
- `requestHash` 使用公共 `QuoteSubmissionInput` 规范化后的固定 JSON 做 SHA-256，保留明细顺序、`null` 与 `0` 的区别。摘要不能替代 `(providerId, key)` 唯一约束。
- 同一服务方、同一键、同一摘要重放原报价：首次写入 201，重放 200，均返回公共 `envelope(Quote)`；同一键不同摘要返回 409 `IDEMPOTENCY_CONFLICT`，不得覆盖旧报价。不同服务方使用同一键互不影响；不同键可创建新的报价版本，是否限制重复业务报价由后续报价状态协议另行冻结。

## 事务会话与账号绑定

- 事务内会话读取器使用 `(request, tx) => unknown | Promise<unknown>`，必须在同一 Prisma transaction client 上重新验证会话签名、过期和撤销状态，并读取当前 `User`、`ServiceProvider` 记录；不能复用预检身份快照。
- `User.providerId` 与 `ServiceProvider.account` 形成一对一绑定，账号角色必须是 `provider`，绑定的服务方记录必须存在，且数据库绑定必须与会话中的 `providerId` 一致。缺失、换绑、角色变化或服务方删除均返回 403。
- 认证适配器异常按未认证处理；默认适配器不产生演示身份。回执重放也要在当前事务中复核读取权限，不能因持有幂等键绕过身份检查。

## 服务方报价权限

- 已验证且已绑定的服务方可以给 `source: live`、`status: published`、非 `demo-demand` 需求报价。
- `draft`、`contracted`、`in_progress`、`completed` 返回 409 `INVALID_STATE`；演示或来源不是 `live` 的需求返回 409 `DEMO_DEMAND_READ_ONLY`。
- 当前数据库没有服务区域关系，城市匹配只用于匹配排序，不作为写入授权条件。后续若增加服务区域或项目邀请关系，必须在事务授权函数中扩展，不能由客户端声明权限。

## 金额与失败语义

- Prisma SQLite `Int` 是有符号 32 位整数，写库字段的金额和工期必须落在 `[-2_147_483_648, 2_147_483_647]`；金额使用非负子范围。公共 `Money` 继续保留安全整数范围，`DatabaseInt`/`DatabaseMoney` 只在持久化边界校验，避免破坏现有预览和历史报价契约。
- `knownTotalCents`、每行 `amountCents` 和 `estimatedDays` 在事务写入前都必须通过数据库范围校验；超范围返回 400 `VALIDATION_ERROR`，不得让 Prisma/SQLite 异常决定 API 语义。
- 事务失败且明确回滚时返回 503；若连接在提交结果未知时中断，客户端必须保留同一 `Idempotency-Key` 供重试，服务端按回执查询结果处理，不能自动换键重发或宣称一定未保存。

## 接入边界

B 后续接入时应调用 `readIdempotencyKey`、`hashQuoteSubmission`、`authorizeProviderAccount` 和 `authorizeProviderQuote`，并将回执写入与报价写入放进同一事务。上述工具只冻结协议和校验，不接通公开写入、真实登录或客户端身份。
