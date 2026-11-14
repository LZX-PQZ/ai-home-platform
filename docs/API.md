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
| POST /api/quote | QuoteSubmissionInput → Quote | B | 处理器已连接事务内核；默认会话参数仍为空，带有效演示 cookie 也返回 401 |
| GET /api/schedule[?demandId=<id>&version=<n>] | Schedule | D | 无参数为演示 mock；带 `demandId` 读取 Prisma 最新/指定版本 |
| GET /api/payment | Payment[] | D | 模拟节点列表；simulated 必须 true |
| GET /api/ticket | Ticket[] | D | 固定 mock |

## POST /api/quote

PR #67 已将处理器接上事务内核，移除了固定的未实现响应。但 `handleQuoteSubmission` 的预检和事务会话参数仍显式使用 `noVerifiedSession`，不会自动采用 `requireProviderIdentity` 的默认演示 reader。因此当前匿名请求和带有效演示 cookie 的公开请求均返回 `401 UNAUTHENTICATED`，不写入报价或回执。B 后续必须在服务端调用处接入两个 reader，并为演示身份的成功回执标注 `meta.source: mock`；当前处理器固定的 live 来源不能直接用于演示身份。

接入有效服务端认证后的处理顺序及现有处理器语义：

- 身份预检优先；无会话 401，非服务方或未绑定服务方 403。认证失败不消费请求体、不查询需求。
- 通过预检后校验 `Idempotency-Key`（16–128 位 ASCII 字母、数字、`-`、`_`），缺失/非法为 `400 VALIDATION_ERROR`；再校验 JSON、公共 `QuoteSubmissionInput` 和整数计价。输入仅为 `demandId`、1–20 行 `items`、`estimatedDays`，禁止客户端指定身份、行合计、总额或状态。
- 数量按千分之一整数缩放，逐行用整数乘法并四舍五入到分后求和；金额和工期在持久化边界校验 SQLite Int 范围。不得用浮点乘法替代。
- 同一事务内重新验证会话/绑定 → 检查当前服务方的回执摘要 → 读取需求并验证写入权限 → 原子提交或重放。首次成功 `201 envelope(Quote)`，同键同摘要且当前授权有效时重放原报价 `200 envelope(Quote)`；不同摘要为 `409 IDEMPOTENCY_CONFLICT`。
- 明确的 P2034/P2002 冲突耗尽重试后为 `503 DATABASE_UNAVAILABLE`；其他无法可靠分类的异常（含提交后确认丢失、坏数据库输出）为 `500 INTERNAL_ERROR`。结果未知时保留原键与原输入，不能自动换键重报，也不能宣称此前一定未保存。

完整决策见 `docs/requests/D-quote-idempotency.md`、`docs/requests/D-demo-provider-session.md`。处理器的隔离数据库测试不等于浏览器登录提交已接通。

## 已预留、当前返回 501
- POST /api/schedule、/api/ticket、/api/inspect、/api/review：由 D 完成。ReviewInput 已预留；其他写入契约先补齐再让页面提交。
- POST /api/payment：已实现最小模拟确认动作，不做身份校验，任何调用方都可触发演示状态转换。输入为 `PaymentActionInput`，只允许 `pending → confirmed_demo` 一次转换；状态只保存在服务进程内，进程重启后恢复初始演示状态。成功返回 `Payment`，`meta.source` 为 `mock` 且 `simulated` 为 `true`；这不是支付接口，不代表真实付款、资金托管或数据库持久化。
- 单需求详情 GET /api/demand/[id] 已建立；A 可使用返回的 ID 查询，未知 ID 返回 404。

### POST /api/inspect

输入使用公共 `PhotoInspectionInput`：`demandId` 加 1–10 个不重复的 `imageRefs`。客户端不上传二进制、不传入验收状态或排期状态；图片引用由后续服务端图片存储/会话链路解释。

接通真实分析后使用 `envelope(PhotoInspectionResult)`，结果包含 `demandId`、`findings[]`（`imageRef`、`severity`、`message`）、可选服务端 `reviewedAt` 和固定免责声明。当前真实分析尚未接通，合法输入返回 HTTP 501 `NOT_IMPLEMENTED`；坏 JSON/非法字段返回 400。501 不能被页面显示为分析成功或验收通过。

## 报价历史回执的当前限制

幂等重放成功的前提是当前事务中的身份、账号绑定和需求授权均通过。`live`、`published`、非演示需求的同键同摘要重放才可返回原报价；需求进入 `contracted`、`in_progress`、`completed` 或变为 `draft` 后，同摘要重放仍返回 `409 INVALID_STATE`，不返回历史回执、不新建或修改记录。此拒绝不表示上一次未保存，客户端不能自动换键重报。同键不同摘要仍优先返回 `409 IDEMPOTENCY_CONFLICT`；需求不存在为 404，身份失效/权限变化为 401/403。

以上规则已由写入内核执行；公开 `POST /api/quote` 尚未接入会话参数，实际仍返回 401。历史幂等回执读取接口未开放，`GET /api/quote` 仍为固定 mock。业主比较列表的独立读取规则如下，不改变 POST 重放限制。完整顺序见 `docs/requests/D-quote-idempotency.md`。

## GET /api/quote?demandId=：已冻结规则，尚未开放

现有 GET 仍返回固定演示报价，尚不解析或执行 demandId 查询。公共 `QuoteQuery`/DTO、D 的事务授权适配器、真实业主会话，以及 B 的公开 GET/页面接线均待后续实现；调用方目前不能把带参数的响应当作该需求的数据库报价。

冻结的目标协议：无参数保留固定 mock；显式查询仅接受单一非空 demandId，拒绝纯空白、重复和未知参数，非空 ID 原样精确查找。仅当前已验证的业主可读取数据库 `DemandOrder.ownerId === session.userId` 的需求；服务方（含演示 provider-a）和管理员均返回 403，此接口不给跨业主或跨服务方的比较权限。

显式查询按参数 400 → 会话 401 → 当前账户/角色 403 → 归属查询的顺序处理。有效业主查询不存在或不属于自己的需求统一返回 `404 DEMAND_NOT_FOUND`，不区分两者，避免透露资源是否存在。凭证、撤销、账户和归属均须在同一事务核验；请求头或参数中的自报身份不参与授权。

业主可读取本人需求在 draft、published、contracted、in_progress、completed 各状态下的 submitted/accepted 报价；不返回 draft/rejected 报价。存在且无可比报价为 `200 envelope(Quote[])` 空数组，不能把查询失败变成空数组。数据库或数据校验失败为 `503 DATABASE_UNAVAILABLE`，不回退 mock。显式查询所有成功和失败响应均须 `Cache-Control: private, no-store`、`Vary: Cookie`，禁止共享缓存。来源按需求的 mock/live 规则；服务方资料仍须独立标识来源。

参数细节、错误优先级、服务端适配器约束和 D/B 后续交付见 `docs/requests/D-quote-read-protocol.md`。

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

B 可从 `@/lib/server-auth` 导入 `readDemoVerifiedSession`，显式传入处理器的 `readSession` 和 `readTransactionSession`；后者由内核传入当前 `tx`。每次验证过期、撤销、账户角色及固定绑定，不复用预检快照。当前公开处理器尚未传入这些参数，所以有效演示 cookie 仍得到 401。演示登录不是生产认证；该服务方身份也不授予业主报价比较读取权限，真实报价读取闭环尚未接通。

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
| PUT /api/demand/[id] | DemandIdParams + DemandUpdateInput | 200 envelope(Demand) | 已实现状态/关联检查；鉴权待接入 |
| DELETE /api/demand/[id] | DemandIdParams | 200 envelope(DemandDeleteResult) | 已实现状态/关联检查；鉴权待接入 |

PUT 完整替换可编辑字段，全部必填，不提供 PATCH。创建/更新禁止客户端设置 id、status 或未知字段；description/city 去除首尾空白后不可为空，面积为有限正数，预算为非负安全整数分且下限不超过上限。更新/删除允许 draft 或尚未签约的 published 需求；进入 contracted、in_progress 或 completed 后返回 409/INVALID_STATE。`demo-demand` 是只读演示数据，更新或删除返回 409/DEMO_DEMAND_READ_ONLY。不存在返回 404/DEMAND_NOT_FOUND，非法输入返回 400/VALIDATION_ERROR。删除前会检查报价、排期、付款、评价和工单关联；存在关联时返回 409/DEMAND_HAS_RELATED_RECORDS。删除结果为 {id,deleted:true}，仍须包含来源信封。

需求路由必须实现鉴权与数据隔离，不得将查询失败回退成 mock。当前需求列表、创建、详情、更新和删除均访问 Prisma；聊天仍为 mock；状态流转仍由后续业务层负责。当前 `PUT /api/demand/[id]` 和 `DELETE /api/demand/[id]` 尚未校验已验证会话或 `ownerId`，因此任何能访问接口的调用方都可能修改或删除非本人真实需求；这是一项已知的答辩前安全缺口，不能视为生产权限边界。后续必须由服务端会话确定业主身份，并在查询、更新、删除中同时执行所有者过滤。`POST /api/demand` 当前也使用固定演示业主归属，接入真实会话前只能作为本地演示能力。
