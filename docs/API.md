# 接口契约 v0.1
字段和校验以 src/contracts/index.ts 为唯一来源。不要从本说明复制类型另建一份。
统一成功结构：
```json
{"ok":true,"data":{},"meta":{"source":"mock"}}
```
统一失败结构：
```json
{"ok":false,"error":{"code":"VALIDATION_ERROR","message":"可读错误"}}
```
HTTP：400 输入错误；404 资源不存在；409 状态冲突；501 尚未实现；503 AI 不可用。
金额人民币分；未知金额 null；不得把含未定费用的报价称作最终总价最低。
契约变更必须同步调用方、mock、测试。浏览器读取可使用 `apiGet(path, Schema)`，提交 JSON 可使用 `apiPost(path, body, Schema)` 或 `apiPut(path, body, Schema)`，无请求体删除可使用 `apiDelete(path, Schema)`；失败时客户端保留 `ApiClientError.code/status`。

## 已提供的接口
未特别说明的接口仍返回固定演示数据；需求接口读取 Prisma，匹配接口支持显式 `demandId` 校验。只有文档已记录并通过测试的查询参数才可在调用方使用。
| 方法/路径 | data 对应契约 | 负责 | 当前状态 |
|---|---|---|---|
| GET /api/health | service、stage | D | 可用 |
| GET /api/auth/demo-provider | DemoProviderSession | D | 读取演示会话状态，始终标 mock；默认 disabled |
| POST /api/auth/demo-provider | DemoProviderLoginInput → DemoProviderSession | D | 显式开启后登录固定演示服务方，设置 HttpOnly cookie |
| DELETE /api/auth/demo-provider | DemoProviderSession | D | 同源退出并撤销数据库会话，清除 cookie |
| GET /api/demand | Demand[] | D | 查询 Prisma；每条 `Demand` 输出 `source`，列表含 `demo-demand` 时整体仍标 mock |
| POST /api/demand | DemandInput → Demand | D | 校验后写入 Prisma，创建为 published，返回 live；无数据库时 503 |
| GET /api/demand/[id] | Demand | D | 按 ID 查询 Prisma；每条输出 `source`，不存在 404，不回退到 demo-demand |
| POST /api/demand/chat | ChatResult | D | 读取 ChatInput；`AI_MODE=mock` 返回 mock，`AI_MODE=live` 调用服务端 LLM 网关并返回 live |
| GET /api/provider | Provider[] | D | 固定 mock |
| GET /api/match[?demandId=<id>] | Match[] | B | 无参数保留演示入口；`demandId=demo-demand` 返回 mock；未知 ID 404，空/重复参数 400 |
| GET /api/quote | Quote[] | B | 固定 mock |
| POST /api/quote | QuoteSubmissionInput → Quote | B | 已接演示会话；合法首次提交 201/mock，同键同摘要重放 200/mock；无有效会话 401 |
| GET /api/schedule[?demandId=<id>&version=<n>] | Schedule | D | 无参数为演示 mock；带 `demandId` 读取 Prisma 最新/指定版本 |
| GET /api/payment | Payment[] | D | 模拟节点列表；simulated 必须 true |
| GET /api/ticket | Ticket[] | D | 固定 mock |

## POST /api/quote

PR #74 已将 `handleQuoteSubmission` 的默认预检及事务会话 reader 接入 `readDemoVerifiedSession`。显式开启演示认证、准备固定账号后，同源有效 cookie 可对非演示、published 的数据库需求提交合法报价：首次 `201`，同键同摘要且当前授权仍有效的重放 `200`，两者均为 `ok: true`、`meta.source: mock`。首次报价及幂等回执各新增一条，重放返回原报价且不重复写入。无有效会话仍返回 `401 UNAUTHENTICATED`，不写入；生产认证未接入，落库不把演示身份变为真实身份。

当前处理顺序及处理器语义：

- 身份预检优先；无会话 401，非服务方或未绑定服务方 403。认证失败不消费请求体、不查询需求。
- 通过预检后校验 `Idempotency-Key`（16–128 位 ASCII 字母、数字、`-`、`_`），缺失/非法为 `400 VALIDATION_ERROR`；再校验 JSON、公共 `QuoteSubmissionInput` 和整数计价。输入仅为 `demandId`、1–20 行 `items`、`estimatedDays`，禁止客户端指定身份、行合计、总额或状态。
- 数量按千分之一整数缩放，逐行用整数乘法并四舍五入到分后求和；金额和工期在持久化边界校验 SQLite Int 范围。不得用浮点乘法替代。
- 同一事务内重新验证会话/绑定 → 检查当前服务方的回执摘要 → 读取需求并验证写入权限 → 原子提交或重放。首次成功 `201 envelope(Quote)`，同键同摘要且当前授权有效时重放原报价 `200 envelope(Quote)`；不同摘要为 `409 IDEMPOTENCY_CONFLICT`。
- 明确的 P2034/P2002 冲突耗尽重试后为 `503 DATABASE_UNAVAILABLE`；其他无法可靠分类的异常（含提交后确认丢失、坏数据库输出）为 `500 INTERNAL_ERROR`。结果未知时保留原键与原输入，不能自动换键重报，也不能宣称此前一定未保存。

完整决策见 `docs/requests/D-quote-idempotency.md`、`docs/requests/D-demo-provider-session.md`。已用真实演示 cookie 和隔离 SQLite 验证公开 POST；本次未做浏览器手工验收，业主公开 GET/页面读取仍未接通。

## 已预留、当前返回 501
- POST /api/schedule、/api/ticket、/api/inspect、/api/review：由 D 完成。ReviewInput 已预留；其他写入契约先补齐再让页面提交。
- POST /api/payment：已实现最小模拟确认动作，不做身份校验，任何调用方都可触发演示状态转换。输入为 `PaymentActionInput`，只允许 `pending → confirmed_demo` 一次转换；状态只保存在服务进程内，进程重启后恢复初始演示状态。成功返回 `Payment`，`meta.source` 为 `mock` 且 `simulated` 为 `true`；这不是支付接口，不代表真实付款、资金托管或数据库持久化。
- 单需求详情 GET /api/demand/[id] 已建立；A 可使用返回的 ID 查询，未知 ID 返回 404。

### POST /api/inspect

输入使用公共 `PhotoInspectionInput`：`demandId` 加 1–10 个不重复的 `imageRefs`。客户端不上传二进制、不传入验收状态或排期状态；图片引用由后续服务端图片存储/会话链路解释。

接通真实分析后使用 `envelope(PhotoInspectionResult)`，结果包含 `demandId`、`findings[]`（`imageRef`、`severity`、`message`）、可选服务端 `reviewedAt` 和固定免责声明。当前真实分析尚未接通，合法输入返回 HTTP 501 `NOT_IMPLEMENTED`；坏 JSON/非法字段返回 400。501 不能被页面显示为分析成功或验收通过。

## 报价历史回执的当前限制

幂等重放成功的前提是当前事务中的身份、账号绑定和需求授权均通过。`live`、`published`、非演示需求的同键同摘要重放才可返回原报价；需求进入 `contracted`、`in_progress`、`completed` 或变为 `draft` 后，同摘要重放仍返回 `409 INVALID_STATE`，不返回历史回执、不新建或修改记录。此拒绝不表示上一次未保存，客户端不能自动换键重报。同键不同摘要仍优先返回 `409 IDEMPOTENCY_CONFLICT`；需求不存在为 404，身份失效/权限变化为 401/403。

以上规则已由写入内核执行；公开 `POST /api/quote` 已接入演示会话，首次和重放成功均标 mock，当前授权失效仍拒绝。历史幂等回执读取接口未开放，`GET /api/quote` 仍为固定 mock。业主比较列表的独立读取规则如下，不改变 POST 重放限制。完整顺序见 `docs/requests/D-quote-idempotency.md`。

## GET /api/quote?demandId=：已冻结规则，尚未开放

现有 GET 仍返回固定演示报价，尚不解析或执行 demandId 查询。D 已提供公共 `QuoteQuery`/DTO、持久化业主会话读取及事务授权器；B 的公开 GET/页面接线和业主身份验证登录入口仍未实现，调用方目前不能把带参数的响应当作该需求的数据库报价。

冻结的目标协议：无参数保留固定 mock；显式查询仅接受单一非空 demandId，拒绝纯空白、重复和未知参数，非空 ID 原样精确查找。仅当前已验证的业主可读取数据库 `DemandOrder.ownerId === session.userId` 的需求；服务方（含演示 provider-a）和管理员均返回 403，此接口不给跨业主或跨服务方的比较权限。

显式查询按参数 400 → 会话 401 → 当前账户/角色 403 → 归属查询的顺序处理。有效业主查询不存在或不属于自己的需求统一返回 `404 DEMAND_NOT_FOUND`，不区分两者，避免透露资源是否存在。凭证、撤销、账户和归属均须在同一事务核验；请求头或参数中的自报身份不参与授权。

业主可读取本人需求在 draft、published、contracted、in_progress、completed 各状态下的 submitted/accepted 报价；不返回 draft/rejected 报价。存在且无可比报价为 `200 envelope(Quote[])` 空数组，不能把查询失败变成空数组。数据库或数据校验失败为 `503 DATABASE_UNAVAILABLE`，不回退 mock。显式查询所有成功和失败响应均须 `Cache-Control: private, no-store`、`Vary: Cookie`，禁止共享缓存。目标来源协议改为同时考虑需求及持久化报价来源：只有需求与所有返回报价都为 live 才标 live，混入 mock 或未知来源即标 mock；空列表沿用已验证的需求来源。D 已提供 schema、兼容字段和来源工具，B 读写适配仍需接入；接入前不得开放会误标 live 的数据库 GET。服务方资料仍须独立标识来源，详见 `docs/requests/D-quote-source.md`。

参数细节、错误优先级、服务端适配器约束和 D/B 后续交付见 `docs/requests/D-quote-read-protocol.md`。

### B 可调用的业主读取入口

从 `@/lib/server-auth` 导入 `parseQuoteQuery`、`readOwnerVerifiedSession`、`authorizeOwnerQuoteRead`、`OwnerAccessError`、`ownerAccessFailureResponse`、`QUOTE_READ_RESPONSE_HEADERS`。`parseQuoteQuery(URLSearchParams)` 仅在无参数时返回 null；非法显式查询抛 400，不回退演示数据。显式查询把 `authorizeOwnerQuoteRead` 直接传给 B 的 `readStoredQuoteComparison`，由 B 内核传入当前 tx；授权器成功返回 true，拒绝抛出带 status/code 的 OwnerAccessError。禁止注入预检身份快照。

`readOwnerVerifiedSession(request, tx)` 必须接收事务客户端。它读取 `__Host-ai_home_owner_session` 的随机凭证，在 OwnerSession 表比对 SHA-256 摘要、到期与撤销状态，再检查当前账户。无效凭证返回 null；当前角色不符抛 403，数据库异常抛 503。授权器将 null 映射为 401；只有有效服务方演示 cookie 时返回 403，不转换为业主。有效业主 cookie 优先，存在但无效/重复的业主 cookie 不回退其他身份。授权器只允许 GET/HEAD，不能用于需求修改/删除。

OwnerSession 的服务端签发/撤销函数仅由 D 内部认证代码使用，不从 server-auth 暴露，也无公开签发路由。签发要求上游已完成身份验证，并检查当前账户仍为 owner；随机 256 位令牌只经 HTTPS 的 Set-Cookie 交付，HttpOnly、Secure、SameSite=Strict、Path=/，绝对有效期 30 分钟。数据库只存摘要。当前密码/外部身份验证与登录/注销路由尚未交付，因此不能宣称已提供可用的业主登录流程。测试中的身份是临时数据库合成夹具，不是生产认证。具体接线和限制见 `docs/requests/D-owner-quote-read-auth.md`。

## 服务端身份基础设施

报价服务端可通过 `src/lib/server-auth.ts` 的 `requireProviderIdentity(request, readSession)` 取得当前服务方身份。`readSession` 必须是服务端已验证会话的适配器，返回 `VerifiedSession` 后才会生成绑定的 `providerId`；请求体、角色切换和客户端自带 `providerId` 均不参与认证。

- 没有已验证会话：401 `UNAUTHENTICATED`。
- 已登录但不是服务方，或会话未绑定服务方：403 `FORBIDDEN`。
- 默认 reader 仅在 `DEMO_AUTH_ENABLED=true` 且有效演示 cookie 对应当前账号绑定时返回固定服务方身份；客户端传入 userId/providerId/角色不能产生会话。过期、撤销、账号删除或绑定不符均视为会话失效，返回 401。真实认证仍未接入。
- 报价 API 与报价引擎可复用 `findDemand`；页面和客户端仍禁止直接导入数据库服务。

### 演示服务方登录

入口位于全局导航下方，始终显示“模拟身份 · 演示专用”；角色导航不等于登录。维护者本地设置 `DEMO_AUTH_ENABLED=true`、运行 `npm run db:setup` 并重启应用后，才可点击“演示服务方登录”。默认关闭，不改已有 `.env`。

登录请求仅为 `{ "action": "login_demo" }`，拒绝任何身份字段。`DemoProviderSession` 是三种状态的联合：`{status:"disabled",demo:true}`、`{status:"signed_out",demo:true}`，以及 `{status:"signed_in",demo:true,identity:{userId:"demo-provider-account",role:"provider",providerId:"provider-a"},expiresAt:"ISO 8601"}`。所有成功响应带 `meta.source: "mock"`，响应不缓存，不包含 cookie 令牌。

Cookie `ai_home_demo_session` 使用 256 位随机凭证；数据库只存摘要、账号和绑定快照，30 分钟绝对过期。HttpOnly、SameSite=Strict、Path=/，HTTPS 时 Secure。POST/DELETE 强制同源 Origin；缺失或跨站为 `403 FORBIDDEN`。POST 未开启为 `403 DEMO_AUTH_DISABLED`，坏 JSON/字段为 400，账号未准备为 `503 DEMO_ACCOUNT_UNAVAILABLE`，数据库错误为 `503 SESSION_UNAVAILABLE`。退出会撤销数据库记录后清除 cookie；关闭演示期间 reader 拒绝所有演示 cookie，同源退出仍可撤销已有会话。

B 已从 `@/lib/server-auth` 导入 `readDemoVerifiedSession`，作为处理器默认的 `readSession` 和 `readTransactionSession`；后者使用内核传入的当前 `tx`。每次验证过期、撤销、账户角色及固定绑定，不复用预检快照。有效演示 cookie 的合法首次提交返回 201/mock，同键重放返回 200/mock；关闭演示、过期、退出或绑定失效仍返回 401。演示登录不是生产认证；该服务方身份也不授予业主报价比较读取权限，真实报价读取闭环尚未接通。

## GET /api/match 查询参数

- `demandId` 是可选的单值查询参数。省略时保留 `demo-demand` 的演示入口，返回 `Match[]`，`meta.source` 为 `mock`。
- 显式传入 `demandId=demo-demand` 时行为相同；传入未知 ID 返回 `404 DEMAND_NOT_FOUND`，不会回退到默认需求。
- 参数为空、纯空白或重复传入返回 `400 VALIDATION_ERROR`。错误响应仍使用统一失败信封。
- 当前匹配结果和服务方资料仍是模拟数据；D 提供需求详情查询后，B 可继续把真实需求接入匹配数据入口。鉴权和数据隔离尚未实现。

## ID 与状态
固定演示需求 demo-demand，服务方 provider-a 到 provider-f。
Demand.status：draft → published → contracted → in_progress → completed；状态流转规则由 D 的业务层实现。
Quote.status：draft/submitted/accepted/rejected；提交报价不等于用户接受。
Schedule 通过 version 表示版本；重新排期应保留旧计划，展示差异并让负责人确认。
Payment 仅 pending/confirmed_demo；不是支付接口。当前 `POST /api/payment` 无身份校验，只做进程内演示状态转换，进程重启后恢复初始状态，不代表真实付款、资金托管或数据库持久化。
Ticket 包含 demandId、responsibleProviderId（可空）、category、status。

## 逐条来源

`Demand.source` 是输出中的可选字段，值为 `mock` 或 `live`；字段缺失表示来源未知。需求服务会为演示需求填入 `mock`，为数据库需求填入 `live`。`DemandInput` 和更新输入不接受该字段，客户端不能声明来源。整体响应的 `meta.source` 继续按整批数据标记，混入 `demo-demand` 时仍为 `mock`。

`Quote.source` 已增加为输出中的可选字段，沿用公共 Source；缺省兼容旧 DTO，不能解释为 live。数据库 `Quote.source` 非空且默认 mock，普通 schema 同步会把无来源的历史记录回填 mock，固定 mock 报价也显式输出 source。`QuoteSubmissionInput` 仍拒绝 source/meta，客户端不能指定来源。B 服务端从 `@/lib/quote-policy` 导入 `parseStoredQuoteSource` 严格校验库值，再用 `summarizeQuoteSources(demand.source, returnedQuotes)` 汇总：全 live 才 live，混合/缺省 mock，空列表沿用需求来源。非法持久化值须报错，不能降级为 mock。B 的首次/重放/GET 映射仍待接入，详见 `docs/requests/D-quote-source.md` 的调用与旧库同步步骤。

## AI 接入
默认 `AI_MODE=mock`，会返回固定追问并标记 `meta.source: "mock"`。设为 `live` 后，服务端读取 `LLM_API_KEY`、`LLM_BASE_URL` 和 `LLM_MODEL`，调用 OpenAI 兼容的 `/chat/completions` JSON 接口；响应必须通过 `ChatResult` 校验后才标记 `meta.source: "live"`。
网关默认超时 5 秒、最多 2 次重试，可由服务端 `LLM_TIMEOUT_MS` 和 `LLM_MAX_RETRIES` 调整。缺少配置、超时、重试耗尽、非 JSON 或不符合契约的模型输出均返回 503 `AI_UNAVAILABLE`，不会伪装成成功或 mock。
模型可生成文字解释和候选方案；费用合计、排期依赖和状态合法性由代码复核。
照片只能辅助提示疑点，不能替代现场检测或证明施工合格。
没有经过出题方确认的 API、性能或产品能力不能写成已接通/已验证。

## 需求 CRUD 契约

对应请求：docs/requests/D-demand-contracts.md。需求创建、详情、更新和删除路由均已实现。

| 方法 | 输入 | 成功返回 | 当前实现 |
|---|---|---|---|
| POST /api/demand | DemandInput | 201 envelope(Demand)，初始 published | 已实现；写入 Prisma，返回 live |
| GET /api/demand/[id] | DemandIdParams | 200 envelope(Demand) | 已实现；按 ID 查询 Prisma，不存在 404 |
| PUT /api/demand/[id] | DemandIdParams + DemandUpdateInput | 200 envelope(Demand) | 已接业主会话、同源检查及事务内归属/状态校验；业主登录入口待实现 |
| DELETE /api/demand/[id] | DemandIdParams | 200 envelope(DemandDeleteResult) | 已接业主会话、同源检查及事务内归属/状态/关联校验与删除 |

PUT 完整替换可编辑字段，全部必填，不提供 PATCH。创建/更新禁止客户端设置 id、ownerId、status、source 或未知字段；description/city 去除首尾空白后不可为空，面积为有限正数，预算为非负安全整数分且下限不超过上限。更新/删除只允许 draft 或 published；进入 contracted、in_progress 或 completed 后返回 409/INVALID_STATE。PUT/DELETE 先验证归属，再检查状态和只读规则：本人 `demo-demand` 返回 409/DEMO_DEMAND_READ_ONLY，他人的演示需求仍为 404。DELETE 检查所有报价（含 draft/rejected）、排期、付款、评价和工单关联，存在关联时返回 409/DEMAND_HAS_RELATED_RECORDS，不级联清除。删除结果为 {id,deleted:true}，仍须包含来源信封。

PUT 的非空 ID 原样精确查找，不去除首尾空白。处理顺序为路径 400 → 同源 Origin 403 → 业主会话预检 401/403/503 → JSON/公共输入校验 400 → 写事务内重新鉴权、按 id + 当前 userId 查询、校验状态并更新。缺少/伪造/重复/过期/撤销的业主凭证返回 401；仅有服务方演示 cookie 也为 401；有效业主凭证对应账户已不再是 owner 为 403。预检失败不消费请求体或读取需求，读取请求体时不持有事务。两次身份不一致为 403。他人和不存在的需求统一返回相同的 404/DEMAND_NOT_FOUND；最后一次更新 SQL 同时过滤 ID、ownerId 和可编辑状态。

PUT 所有响应均带 `Cache-Control: private, no-store`、`Vary: Cookie`。输出 DTO 在事务内验证，拒绝、非法输出及写入异常回滚；存储/事务异常返回 503/DATABASE_UNAVAILABLE，不回退 mock。异常响应只说明暂时无法确认更新结果，调用方应刷新核实，不能推断此前一定未保存。成功返回数据库需求及 `meta.source: live`。完整协议及验证见 `docs/requests/D-demand-update-auth.md`。

DELETE 无请求体，非空 ID 原样精确查找，错误顺序为路径 400 → 方法/同源 Origin 403 → 事务内业主会话 401/403/503 → 本人需求 404 → 只读/状态/关联约束 409 → 删除。凭证规则与 PUT 一致；他人和不存在统一 404。会话、当前账号、归属、状态、五类关联检查、删除及输出校验全部处于同一个 Serializable 事务；最后 DELETE SQL 也限制 ID、ownerId、可编辑状态和关联均为空，必须恰好删除一条。成功为 200/live，重复删除为 404；所有响应 private, no-store、Vary: Cookie。事务/存储故障为中性 503/DATABASE_UNAVAILABLE，提示刷新核实，不承诺之前一定未删除。详见 `docs/requests/D-demand-delete-auth.md`。

需求 POST 仍固定归属 demo-owner，列表/详情仍缺少访问隔离。PUT/DELETE 的修复不能代表整个需求模块已形成生产权限边界。业主密码登录已在 PR #90 单独提交，尚待合入；本 PR 基线尚无浏览器登录入口，测试使用临时数据库合成账号及 D 内部签发函数，不是公开登录流程。后续事项已登记在 `docs/tasks/D.md`。
