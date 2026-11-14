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
| GET /api/auth/owner | OwnerSessionState | D | 读取业主凭证和当前账户，返回 signed_in / signed_out，不续期 |
| POST /api/auth/owner | OwnerLoginInput → OwnerSessionState | D | 验证密码并在事务内重验凭证/角色，轮换当前浏览器的业主会话 |
| DELETE /api/auth/owner | OwnerSessionState | D | 同源撤销当前会话，成功后清除 cookie，可重复退出 |
| GET /api/demand | Demand[] | D | 无业主 cookie 可公开读取 published；有效业主仅本人所有状态；坏业主凭证 401，不接受查询参数 |
| POST /api/demand | DemandInput → Demand | D | 验证业主会话后写入本人需求，published/live；无会话 401，存储故障 503 |
| GET /api/demand/[id] | Demand | D | 精确 ID 查询；published 公开，非公开仅所属业主可读；不可访问/不存在统一 404 |
| POST /api/demand/chat | ChatResult | D | 读取 ChatInput；`AI_MODE=mock` 返回 mock，`AI_MODE=live` 调用服务端 LLM 网关并返回 live |
| GET /api/provider | Provider[] | D | 固定 mock |
| GET /api/provider/quotes | Quote[] | D | 同一事务验证服务方会话并只查本人报价；当前演示身份整体标 mock，不代表接单 |
| POST /api/order | OrderAcceptInput → OrderSummary | D | 所属业主接受已提交报价，原子建立单一接单关系；首次 201，同报价重放 200，保留报价来源 |
| GET /api/provider/orders | OrderSummary[] | D | 同一事务验证服务方并只查本人接单关系；无参数，当前演示身份整体 mock |
| GET /api/match[?demandId=<id>] | Match[] | B | 无参数保留演示入口；`demandId=demo-demand` 返回 mock；未知 ID 404，空/重复参数 400 |
| GET /api/quote | Quote[] | B | 固定 mock |
| POST /api/quote | QuoteSubmissionInput → Quote | B | 已接演示会话；合法首次提交 201/mock，同键同摘要重放 200/mock；无有效会话 401 |
| GET /api/schedule[?demandId=<id>&version=<n>] | Schedule | D | 无参数或固定 demo-demand 为公开种子排期 mock；其他需求验证业主会话及归属后读取最新/指定版本 |
| POST /api/schedule | ScheduleCreateInput → Schedule | D | 当前业主为本人 published/contracted 且无排期的需求创建 v1；201/live，工序均 pending 且责任服务方为空 |
| PUT /api/schedule | ScheduleRevisionInput → Schedule | D | 业主确认修订本人未开工且未分配责任方的计划，校验基准版本后追加下一版，201/live；旧版保留 |
| GET /api/payment | Payment[] | D | 模拟节点列表；simulated 必须 true |
| GET /api/ticket[?demandId=<id>] | Ticket[] | D | 无参数/精确 demo-demand 返回固定 mock；其他需求仅所属业主可读 |
| POST /api/ticket | TicketCreateInput → Ticket | D | 当前业主为本人已发布及后续状态需求创建 open 工单，责任方 null；201/live |
| POST /api/inspect/images | multipart InspectionUploadFields + images → InspectionUploadResult | D | 当前业主上传本人需求的 JPEG/PNG，真实解码去元数据并原子保存，201/live，引用 24 小时有效 |
| POST /api/inspect | PhotoInspectionInput → 失败信封 | D | 同源、业主及已上传引用校验；全部有效后仍 501，AI 分析未接通 |

## 接受报价与本人接单

`POST /api/order` 接收公共 `OrderAcceptInput`：`{ demandId, quoteId, confirmed: true }`。ID 非空且非纯空白，原样精确匹配；拒绝其他字段、查询参数及超过 4096 字节的正文。真实业主同源确认后，只能首次接受本人非演示 published 需求的 submitted 报价；同一 Serializable 事务重新验证身份、当前角色、归属和原始报价，原子执行需求 contracted、报价 accepted、ServiceOrder 创建。每需求最多一条关系，关联报价唯一；失败或坏输出全部回滚，其他报价和原提交幂等回执保留。

首次 201 `envelope(OrderSummary)`，相同需求和报价的当前授权重放 200 返回原关系，不重复写入；另一报价 409/ORDER_ALREADY_EXISTS。无接单关系时，非 published 需求为 409/INVALID_STATE；published 需求已有旧 accepted 报价为 409/ACCEPTED_QUOTE_CONFLICT，不自动补单。仅支持单需求单服务方；接单关系保存不表示签署法律合同、付款、开工或完成施工。未确定费用/null 原样保留，不能当作零或已确认最终总价。签约后原报价 POST 及原提交回执重放仍受 published 限制。

`OrderSummary` 必含 id、demandId、providerId、acceptedQuoteId、status（contracted/in_progress/completed）及 source。当前只创建 contracted，不提供后续状态推进；一致的后续状态记录可重放读取。来源沿用被接受报价的持久化来源，POST 整体与逐条一致；mock 不因业主点击或落库升级为 live。

`GET /api/provider/orders` 无参数，服务端在同一事务验证当前服务方会话及绑定，再按 providerId 查询实际关系并校验关联需求/accepted 报价；按 ID 升序，不表示时间排序。历史报价不会凭 accepted 状态进入接单列表，只有授权且实际无关系才返回成功空数组。当前固定演示服务方身份让列表整体（含空列表）为 mock，每条保留 source；它不等于生产服务方认证。有效服务方 cookie 优先，与 `/api/provider/quotes` 一致；只有业主会话 403，无/失效/重复/关闭演示或绑定失效为 401，不能靠身份参数或角色头选用户。

写入无效业主会话或仅服务方 cookie 为 401；角色变化/跨源 403；非本人和不存在需求统一 404/DEMAND_NOT_FOUND，确认本人归属后其他需求的报价与不存在报价统一 404/QUOTE_NOT_FOUND。本人演示需求 409/DEMO_DEMAND_READ_ONLY，非法状态 409/INVALID_STATE。读写存储、事务、坏来源/DTO/关联不一致均 503/ORDER_UNAVAILABLE，提示结果暂时无法确认，可对同一报价重试核实。所有成功/失败 private, no-store、Vary: Cookie，不回退 mock 或空成功。

B 接入 `apiPost('/api/order', input, OrderSummary)` 并在明确确认前展示报价、待定费用和来源，成功后刷新报价/需求；C 接入 `apiGet('/api/provider/orders', OrderSummary.array())`，区分本人报价和接单，展示来源及错误。此次未修改两方页面，按钮/接单 UI、生产服务方认证、改选/取消、多服务方拆单及履约推进未实现。数据库须先运行 `npm run db:setup` 同步新表，seed 不补造关系。详见 `docs/requests/D-quote-acceptance.md`。

## 工单创建与读取

`POST /api/ticket` 仅接收公共 `TicketCreateInput`：demandId、description、category。ID 非空且非纯空白，保留原值精确匹配；描述去首尾空白后 1–4000 字符；分类复用 quality/schedule/payment/attitude。拒绝所有额外字段（包括身份、id、状态、责任服务方和来源），正文最多 16 KiB，不接受查询参数。

同源写入先校验实际业主会话，再于事务外读取正文；Serializable 写事务重验同一身份、当前角色、需求归属/状态。仅本人非演示需求的 published/contracted/in_progress/completed 可创建，draft 不可。最终 SQL 同时限制 ID、ownerId 和当前状态，输出在提交前校验、失败回滚。成功 201 `envelope(Ticket)`/live，服务端生成 ID，status=open、responsibleProviderId=null，不改变需求状态。live 只表示业主报告实际落库，不表示投诉属实、责任认定、派单、通知或售后完成。没有幂等键/内容去重，重复提交会创建独立工单；网络错误或 503 后先读取核实，不能自动重报。

`GET /api/ticket?demandId=…` 仅接收恰好一个非空 demandId，拒绝未知/重复参数。在同一事务验证实际业主和需求归属，再按需求及当前 ownerId 查询 Ticket[]，按 id 升序（不表示时间顺序）；本人所有状态均可读，确实无工单为 200/live 空数组。他人与不存在需求统一 404/DEMAND_NOT_FOUND。公开需求详情不授予工单读取权限。

无参数或精确 demo-demand 返回固定种子工单/mock，不读取可变数据库记录。存在业主 cookie 时仍需验证：坏/重复/过期/撤销均 401，角色变更 403，不回退匿名。无参数不会列出当前业主或全站的真实工单，C 现有管理演示页保持固定 mock。

读写缺失/失效业主凭证、只有服务方凭证均为 401/UNAUTHENTICATED；当前账户角色不是 owner 或非同源写入为 403/FORBIDDEN。本人固定演示需求写入 409/DEMO_DEMAND_READ_ONLY，非法状态 409/INVALID_STATE；JSON/字段错误 400。数据库/事务/坏 DTO 返回中性 503/TICKET_UNAVAILABLE，不回退 mock 或空成功。所有响应 private, no-store、Vary: Cookie。接入使用共享 `apiPost(..., Ticket)` / `apiGet(..., Ticket.array())` 并显示来源；表单、管理授权、派单/解决、通知尚未实现。详见 `docs/requests/D-ticket-create.md`。

## GET /api/schedule

无查询参数或 demandId 精确等于已有 DEMO_DEMAND_ID（demo-demand）时返回与 seed 共用的固定演示排期并标 mock，不读取数据库内同 ID 的可变排期。带不带 version 均无需登录；固定排期当前版本为 1，指定其他合法版本返回 404/SCHEDULE_NOT_FOUND。不能按需求 published 状态或来源 mock 放开其他 ID。显式查询使用公共 ScheduleQuery：恰好一个非空 demandId、至多一个十进制正整数 version；拒绝未知/重复/身份参数和超出数据库整数范围的版本，非空 ID 原样精确匹配。

演示入口没有业主 cookie 时直接返回固定数据，服务方身份不限制演示访问；只要带业主 cookie，仍先验证持久化会话，伪造/重复/过期/撤销返回 401，当前账号不再是业主返回 403，不回退匿名。这同时适用于无参数及显式 demo-demand。有效业主无需拥有演示需求。

其他需求在同一 Serializable 事务核验实际业主 cookie、有效期/撤销、当前角色及需求归属，再读取最新或指定版本。缺失/失效业主凭证为 401；当前非业主角色或只有有效演示服务方凭证为 403。有效业主 cookie 优先，失效或重复业主凭证不回退其他身份。本人需求各状态均可读取；真实需求详情公开不代表排期也公开。

他人与不存在的非演示需求统一 404/DEMAND_NOT_FOUND；确认本人需求后，缺少排期或指定版本才返回 404/SCHEDULE_NOT_FOUND。存储、事务、DTO 或返回归属/版本校验失败为 503/SCHEDULE_UNAVAILABLE，不回退演示。所有读取响应 private, no-store、Vary: Cookie。普通数据库排期沿用 live，不代表真实施工或 AI 排期。A 可沿用 apiGet(..., Schedule)，真实需求在共享业主登录后刷新/重试，演示排期始终显示 mock；接口与验证见 `docs/requests/D-schedule-read-auth.md`。首版写入见下节。

## POST /api/schedule：首版手工计划

输入仅为公共 `ScheduleCreateInput`：demandId 和 1–100 项 tasks，每项含 id、name、startDay、durationDays、dependsOn。工序 ID 唯一，依赖不能重复、自引用、缺失或成环，开始日不得早于依赖结束；独立任务可并行。天数为符合数据库整数范围的非负开始日与正工期，结束日不能溢出；ID 精确匹配、名称去首尾空格。正文最多 64 KiB，顶层及工序均拒绝未知字段，客户端不能指定身份、来源、版本、状态、责任服务方或验收结论。

仅同源 POST，无查询参数；真实业主会话预检后在事务外读正文，再在 Serializable 写事务重验当前会话、账户角色和需求归属。只允许本人非演示需求在 published/contracted 且尚无任意版本排期时创建；最终嵌套写入仍限定 ID、ownerId、当前状态及空排期，输出校验失败回滚。成功 201 `envelope(Schedule)` / live，固定 version=1，所有工序 status=pending、responsibleProviderId=null；live 表示实际保存手工计划，不代表真实施工或 AI 生成，需求状态不改变。

无/失效/撤销/重复/过期业主 cookie 为 401，只有演示服务方 cookie 同样 401，当前账户角色不符或同源失败为 403；非本人和不存在需求统一 404/DEMAND_NOT_FOUND。确认归属后，固定演示需求 409/DEMO_DEMAND_READ_ONLY，不可创建状态 409/INVALID_STATE，已有任何版本 409/SCHEDULE_ALREADY_EXISTS。重复请求不覆盖、不追加版本，应通过 GET 核实；事务/数据库冲突或坏输出为中性的 503/SCHEDULE_UNAVAILABLE，不宣称一定未保存。所有响应 private, no-store、Vary: Cookie；坏 JSON 400/INVALID_JSON，非法字段、正文超限或依赖 400/VALIDATION_ERROR。

A 可用 `apiPost('/api/schedule', input, Schedule)` 保存后刷新现有 GET。未开工计划的确认修订与版本追加见下节 PUT；创建表单、施工中变更审批、任务状态推进、责任方分配与阶段验收尚未交付。现有变更/验收按钮不能当作创建入口。首版字段及接入说明见 `docs/requests/D-schedule-create.md`。

## PUT /api/schedule：确认修订未开工计划

新增公共 `ScheduleRevisionInput`：demandId、baseVersion、confirmed、tasks。baseVersion 是当前最新版本，必须为小于 SQLite Int 上限的正整数；confirmed 必须显式 true。其余字段和依赖图复用首版创建规则，完整提交 1–100 个工序；请求体上限 64 KiB，拒绝查询参数及任何额外字段（身份、目标 version、状态、责任方、来源等）。旧版工序可以在新版增删/改名/调整工期，旧版记录不变。

同源及实际业主预检通过后，事务外读取正文；Serializable 写事务重验同一身份、当前账号角色、需求归属/状态与最新排期。仅本人非演示 published/contracted 需求，且最新计划全部 pending、responsibleProviderId=null 可修订；已开工/完成/阻塞或已有责任方的工序不能被重置。最新计划同时经过公共字段、版本范围与依赖图校验，坏数据返回 503，不能以修订掩盖。

baseVersion 与最新版本不符返回 409/SCHEDULE_VERSION_CONFLICT；页面必须刷新比较并重新确认，不能自动换版本重发。最终写入再次限定需求归属/状态、原计划 ID/版本/内容及无更新版本，只追加下一版，不覆盖历史；输出校验失败回滚。同基准版本并发最多成功一个新版，其余 409 或 503。成功 201 envelope(Schedule)/live，version=baseVersion+1，工序均 pending 且责任方为空，需求状态不变；live 仅表示保存手工计划，confirmed 不代表他人审批或验收。

无/坏/重复/过期/撤销业主 cookie 或仅服务方 cookie 返回 401；角色不符、身份中途变化或同源失败 403；他人与不存在需求统一 404/DEMAND_NOT_FOUND。本人需求无初版为 404/SCHEDULE_NOT_FOUND；本人演示需求 409/DEMO_DEMAND_READ_ONLY，非法需求状态 409/INVALID_STATE，最新计划已有施工状态/责任方 409/SCHEDULE_REVISION_NOT_ALLOWED。JSON/字段错误 400，数据库、事务竞争或坏输出为中性 503/SCHEDULE_UNAVAILABLE，需 GET 核实结果。所有响应 private, no-store、Vary: Cookie。

调用使用 `apiPut('/api/schedule', input, Schedule)`，现有 GET 仍支持最新及指定历史版本。本次未实现 A 的修订表单/差异展示、变更原因/审批审计记录、施工中异常变更、服务方确认、任务状态推进或验收。完整字段和验收见 `docs/requests/D-schedule-revision.md`。

## GET /api/provider/quotes

无参数的本人报价列表，任何查询参数为 400；不能传 providerId 指定身份。使用现有服务方演示登录，在同一事务核验会话、当前角色与绑定，只查询绑定 providerId 的持久化 Quote，逐条重验归属和公共契约。返回本人 draft/submitted/accepted/rejected 报价，按 id 升序（不表示提交时间或成交顺序），不暴露内部幂等字段及业主资料。

匿名/失效/撤销/过期/重复凭证、演示关闭或账号绑定变化为 401；只有业主身份为 403。存储故障或 JSON/来源/DTO 损坏为 503，不回退固定 mock 或成功空数组；鉴权成功且确实无本人报价才返回空数组。所有成功与失败响应 private, no-store、Vary: Cookie。

逐条 source 保留持久化来源且严格校验，null 费用不当作 0；当前会话为演示服务方，整体 meta.source 始终 mock（含空数组及单条 live 的情况）。这提供“本人报价”，不创建或证明接单关系；`GET /api/provider/orders` 和生产服务方登录尚未交付。C 接线说明见 `docs/requests/D-provider-own-quotes.md`，页面修改由 C 维护。

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
- POST /api/inspect 的真实分析、POST /api/review：由 D 后续完成。照片已可通过 /api/inspect/images 上传，但 /api/inspect 校验身份和引用后仍明确 501。ReviewInput 已预留；写入契约先补齐再让页面提交。POST /api/schedule 已实现首版计划创建，PUT /api/schedule 已实现未开工计划确认修订，POST /api/ticket 已实现业主创建工单，见上节；施工中变更与验收、工单派单与解决仍未实现。
- POST /api/payment：已实现最小模拟确认动作，不做身份校验，任何调用方都可触发演示状态转换。输入为 `PaymentActionInput`，只允许 `pending → confirmed_demo` 一次转换；状态只保存在服务进程内，进程重启后恢复初始演示状态。成功返回 `Payment`，`meta.source` 为 `mock` 且 `simulated` 为 `true`；这不是支付接口，不代表真实付款、资金托管或数据库持久化。
- 单需求详情 GET /api/demand/[id] 已建立；A 可使用返回的 ID 查询，未知 ID 返回 404。

### POST /api/inspect/images 与 POST /api/inspect

上传使用同源 multipart/form-data，恰好一个文本 demandId 和同名 images 的 1–10 个 File，不接受其他字段及查询参数。公共 `InspectionUploadFields`、`InspectionUploadedImage`、`InspectionUploadResult` 与 `INSPECTION_UPLOAD_LIMITS` 是字段/限制唯一来源。真实业主会话预检后限长读取正文，事务内验证本人非演示、非 draft 需求，事务外解码，最终事务重验身份/角色/归属/状态和配额，再条件嵌套保存整批照片；任一失败不保留部分结果。

仅 JPEG/PNG，MIME 与实际格式必须一致；拒绝空、损坏、动画/多页、SVG 及批内原内容或标准化后重复的图片。每张输入/输出最多 2 MiB，整批各最多 10 MiB，整个 multipart 正文最多 11 MiB；单边 4096，像素 1600 万。按照 EXIF 方向旋转、重编码并移除元数据，不保存原图/文件名。进程最多两个上传在处理，单图原生处理设 5 秒超时（不含等待线程的时间）。

成功 201 `envelope(InspectionUploadResult)`/live，data 为 `{ demandId, images: [{ imageRef, contentType, sizeBytes, width, height, expiresAt }] }`。随机 `inspect-image/<UUID>` 引用 24 小时有效，不是公开 URL；大小/尺寸对应实际保存的照片。二进制、SHA-256、ownerId 和 demandId 存 SQLite；live 仅表示保存成功，不表示分析或验收。每业主最多 50 张/50 MiB 有效照片，数据库最多 5000 条/500 MiB 记录。过期引用立即拒绝；本人的后续成功上传清理其过期记录，无后台清理或到期物理擦除保证。需求删除级联删除临时照片，原有业务关联仍限制删除。无上传幂等键，重传产生新引用并计入配额。

检查继续使用公共 `PhotoInspectionInput`：demandId 加 1–10 个不重复 imageRefs，JSON 最多 32 KiB，不接二进制、身份或业务状态。必须使用上传回执中的引用；同一事务校验当前业主、需求、每个引用的归属/有效期/存储摘要，不下载客户端 URL。文件名、未知/过期/跨需求/跨业主引用统一 404/IMAGE_NOT_FOUND；非本人/不存在需求统一 404/DEMAND_NOT_FOUND。全部引用有效后仍 501/NOT_IMPLEMENTED，没有 findings、data 或 meta，也不更新任何业务状态。

两个接口均拒绝匿名、坏/重复/撤销/过期会话和仅服务方身份（401）；非同源或当前角色不符 403；演示/非法需求状态 409；坏 JSON、字段、文件或超限正文 400；配额 409/IMAGE_QUOTA_EXCEEDED，繁忙 429/IMAGE_UPLOAD_BUSY；数据库、坏 DTO/摘要或结果不确定 503/IMAGE_STORAGE_UNAVAILABLE。所有响应 private, no-store、Vary: Cookie。接口不回退 mock。

A 页面尚未接线：先 fetch FormData，勿手写 Content-Type，再用公共 envelope 校验上传结果；apiPost 仅适用于第二步 JSON。现有文件名不是合法已上传引用。真实分析未来仍须返回 PhotoInspectionResult 并保留固定免责声明；501 不能显示分析成功或验收通过。预览/删除管理、对象存储、生产保留策略和人工复核未实现。部署 npm ci、npm run db:setup 后重启，不 reset 数据库。详见 docs/requests/D-photo-image-upload.md。

## 报价历史回执的当前限制

幂等重放成功的前提是当前事务中的身份、账号绑定和需求授权均通过。`live`、`published`、非演示需求的同键同摘要重放才可返回原报价；需求进入 `contracted`、`in_progress`、`completed` 或变为 `draft` 后，同摘要重放仍返回 `409 INVALID_STATE`，不返回历史回执、不新建或修改记录。此拒绝不表示上一次未保存，客户端不能自动换键重报。同键不同摘要仍优先返回 `409 IDEMPOTENCY_CONFLICT`；需求不存在为 404，身份失效/权限变化为 401/403。

以上规则已由写入内核执行；公开 `POST /api/quote` 已接入演示会话，首次和重放成功均标 mock，当前授权失效仍拒绝。历史幂等回执读取接口未开放，`GET /api/quote` 仍为固定 mock。业主比较列表的独立读取规则如下，不改变 POST 重放限制。完整顺序见 `docs/requests/D-quote-idempotency.md`。

## GET /api/quote?demandId=：已冻结规则，尚未开放

现有 main 的 GET 仍返回固定演示报价，尚不解析或执行 demandId 查询。D 已提供公共 `QuoteQuery`/DTO、持久化业主会话读取及事务授权器，本次补齐密码登录入口；B 的公开 GET 接线位于待合入 PR #79，D 已另提 #87 修正来源断言，页面接线仍待 B 完成。#79 合入前调用方不能把带参数的响应当作该需求的数据库报价。

冻结的目标协议：无参数保留固定 mock；显式查询仅接受单一非空 demandId，拒绝纯空白、重复和未知参数，非空 ID 原样精确查找。仅当前已验证的业主可读取数据库 `DemandOrder.ownerId === session.userId` 的需求；服务方（含演示 provider-a）和管理员均返回 403，此接口不给跨业主或跨服务方的比较权限。

显式查询按参数 400 → 会话 401 → 当前账户/角色 403 → 归属查询的顺序处理。有效业主查询不存在或不属于自己的需求统一返回 `404 DEMAND_NOT_FOUND`，不区分两者，避免透露资源是否存在。凭证、撤销、账户和归属均须在同一事务核验；请求头或参数中的自报身份不参与授权。

业主可读取本人需求在 draft、published、contracted、in_progress、completed 各状态下的 submitted/accepted 报价；不返回 draft/rejected 报价。存在且无可比报价为 `200 envelope(Quote[])` 空数组，不能把查询失败变成空数组。数据库或数据校验失败为 `503 DATABASE_UNAVAILABLE`，不回退 mock。显式查询所有成功和失败响应均须 `Cache-Control: private, no-store`、`Vary: Cookie`，禁止共享缓存。目标来源协议改为同时考虑需求及持久化报价来源：只有需求与所有返回报价都为 live 才标 live，混入 mock 或未知来源即标 mock；空列表沿用已验证的需求来源。D 已提供 schema、兼容字段和来源工具，B 读写适配仍需接入；接入前不得开放会误标 live 的数据库 GET。服务方资料仍须独立标识来源，详见 `docs/requests/D-quote-source.md`。

参数细节、错误优先级、服务端适配器约束和 D/B 后续交付见 `docs/requests/D-quote-read-protocol.md`。

### B 可调用的业主读取入口

从 `@/lib/server-auth` 导入 `parseQuoteQuery`、`readOwnerVerifiedSession`、`authorizeOwnerQuoteRead`、`OwnerAccessError`、`ownerAccessFailureResponse`、`QUOTE_READ_RESPONSE_HEADERS`。`parseQuoteQuery(URLSearchParams)` 仅在无参数时返回 null；非法显式查询抛 400，不回退演示数据。显式查询把 `authorizeOwnerQuoteRead` 直接传给 B 的 `readStoredQuoteComparison`，由 B 内核传入当前 tx；授权器成功返回 true，拒绝抛出带 status/code 的 OwnerAccessError。禁止注入预检身份快照。

`readOwnerVerifiedSession(request, tx)` 必须接收事务客户端。它读取 `__Host-ai_home_owner_session` 的随机凭证，在 OwnerSession 表比对 SHA-256 摘要、到期与撤销状态，再检查当前账户。无效凭证返回 null；当前角色不符抛 403，数据库异常抛 503。授权器将 null 映射为 401；只有有效服务方演示 cookie 时返回 403，不转换为业主。有效业主 cookie 优先，存在但无效/重复的业主 cookie 不回退其他身份。授权器只允许 GET/HEAD，不能用于需求修改/删除。

OwnerSession 的服务端签发/撤销函数仅由 D 内部认证代码使用，不从 server-auth 暴露，也不提供按 userId 直接签发的接口。`POST /api/auth/owner` 验证密码后，在写事务内重新核验当前凭证和 owner 角色，再签发随机 256 位 cookie。Cookie 使用 `__Host-ai_home_owner_session`、HttpOnly、Secure、SameSite=Strict、Path=/，绝对有效期 30 分钟，数据库仅存摘要。业务读取器和授权器签名不变，继续在调用方事务中校验。基础设施记录见 `docs/requests/D-owner-quote-read-auth.md`，登录协议见下节。

### 业主密码登录

`OwnerLoginInput` 仅为 `{login,password}`：账号 3–64 位 ASCII 字母、数字或 `._-`，去除首尾空白并转小写；密码 15–128 字符，保留原值。未知字段一律拒绝。正文最多 4096 字节，非法 JSON/字段或超大正文统一 400/VALIDATION_ERROR。账号由维护者交互运行 `npm run owner:create` 开通，只创建新 owner；没有公开注册、默认密码或自动接管演示账号。

POST/DELETE 强制同源 Origin，缺失/跨源或 cross-site 返回 403/FORBIDDEN；所有三种方法仅支持 HTTPS 或 localhost/127.0.0.1/[::1] 的本地 HTTP。不会因 forwarded 头降低检查。成功 `envelope(OwnerSessionState)` 标 live：`{status:"signed_out"}` 或 `{status:"signed_in",identity:OwnerIdentity,expiresAt:"ISO 8601"}`；cookie/密码/摘要不进入 JSON。所有响应 `Cache-Control: private, no-store` 和 `Vary: Cookie`。

密码使用随机盐的 scrypt 摘要，未知账号执行同等密码计算。错误密码、未知账号、当前角色不符及验证期间凭证变化均返回相同 401/INVALID_CREDENTIALS。每账号只统计认证失败，15 分钟最多 5 次失败，第六次起限流；成功不计数且原子清空该账号失败历史，未知账号规则相同，重启不清零。已移除全局 60 次锁定，一个账号不会耗尽其他账号的登录额度；新版 failure: 键不继承旧版包含成功次数的锁定。超限或进程密码计算繁忙为 429/RATE_LIMITED，带 Retry-After，繁忙只需短暂重试且不计失败。存储或摘要错误为 503/SESSION_UNAVAILABLE，不暴露内部异常，不声称已登录或退出。详见 `docs/requests/D-owner-login-throttle.md`。

POST 在事务外计算密码，再在写事务重读凭证和角色，撤销此浏览器的旧业主会话并签发新凭证；签发失败回滚撤销。GET 读取当前账户，不续期；无效/重复/过期/撤销凭证或账户不再是 owner 时显示 signed_out。DELETE 可幂等退出，存储撤销成功后才清 cookie；服务方演示会话独立保留。浏览器已使用临时合成账号验收错误密码、登录、刷新、本人需求编辑、退出后编辑被拒绝；这不是实名认证，也不代表其余业务访问控制已补齐。

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
| POST /api/demand | DemandInput | 201 envelope(Demand)，初始 published | 已接同源与实际业主会话；事务内以当前业主为 ownerId |
| GET /api/demand/[id] | DemandIdParams | 200 envelope(Demand) | 事务内限定范围；published 公开，非公开仅所属业主可读 |
| PUT /api/demand/[id] | DemandIdParams + DemandUpdateInput | 200 envelope(Demand) | 已接业主会话、同源检查及事务内归属/状态校验，可使用密码登录凭证 |
| DELETE /api/demand/[id] | DemandIdParams | 200 envelope(DemandDeleteResult) | 已接业主会话、同源检查及事务内归属/状态/关联校验与删除 |

PUT 完整替换可编辑字段，全部必填，不提供 PATCH。创建/更新禁止客户端设置 id、ownerId、status、source 或未知字段；description/city 去除首尾空白后不可为空，面积为有限正数，预算为非负安全整数分且下限不超过上限。更新/删除只允许 draft 或 published；进入 contracted、in_progress 或 completed 后返回 409/INVALID_STATE。PUT/DELETE 先验证归属，再检查状态和只读规则：本人 `demo-demand` 返回 409/DEMO_DEMAND_READ_ONLY，他人的演示需求仍为 404。DELETE 检查所有报价（含 draft/rejected）、排期、付款、评价和工单关联，存在关联时返回 409/DEMAND_HAS_RELATED_RECORDS，不级联清除。删除结果为 {id,deleted:true}，仍须包含来源信封。

PUT 的非空 ID 原样精确查找，不去除首尾空白。处理顺序为路径 400 → 同源 Origin 403 → 业主会话预检 401/403/503 → JSON/公共输入校验 400 → 写事务内重新鉴权、按 id + 当前 userId 查询、校验状态并更新。缺少/伪造/重复/过期/撤销的业主凭证返回 401；仅有服务方演示 cookie 也为 401；有效业主凭证对应账户已不再是 owner 为 403。预检失败不消费请求体或读取需求，读取请求体时不持有事务。两次身份不一致为 403。他人和不存在的需求统一返回相同的 404/DEMAND_NOT_FOUND；最后一次更新 SQL 同时过滤 ID、ownerId 和可编辑状态。

PUT 所有响应均带 `Cache-Control: private, no-store`、`Vary: Cookie`。输出 DTO 在事务内验证，拒绝、非法输出及写入异常回滚；存储/事务异常返回 503/DATABASE_UNAVAILABLE，不回退 mock。异常响应只说明暂时无法确认更新结果，调用方应刷新核实，不能推断此前一定未保存。成功返回数据库需求及 `meta.source: live`。完整协议及验证见 `docs/requests/D-demand-update-auth.md`。

POST 先校验同源 Origin 和实际业主会话，在事务外读取/校验 DemandInput，再在写事务内重验会话和当前账号角色；两次身份不同为 403。ownerId 仅取最终验证的当前 userId，初始 published，禁止客户端身份/状态/来源字段。成功 201/live，公共输出在事务内验证；无会话 401、非业主/跨源 403、输入 400，存储或未知提交结果 503 提示刷新核实。所有响应 private, no-store、Vary: Cookie。已移除固定 demo-owner 创建入口，历史需求归属不自动转移。验收通过实际登录 → 创建 → 修改 → 演示服务方报价 → 本人读取，另一业主无法修改或读取该报价。详见 `docs/requests/D-demand-create-auth.md`。

DELETE 无请求体，非空 ID 原样精确查找，错误顺序为路径 400 → 方法/同源 Origin 403 → 事务内业主会话 401/403/503 → 本人需求 404 → 只读/状态/关联约束 409 → 删除。凭证规则与 PUT 一致；他人和不存在统一 404。会话、当前账号、归属、状态、五类关联检查、删除及输出校验全部处于同一个 Serializable 事务；最后 DELETE SQL 也限制 ID、ownerId、可编辑状态和关联均为空，必须恰好删除一条。成功为 200/live，重复删除为 404；所有响应 private, no-store、Vary: Cookie。事务/存储故障为中性 503/DATABASE_UNAVAILABLE，提示刷新核实，不承诺之前一定未删除。详见 `docs/requests/D-demand-delete-auth.md`。

需求 POST 当前业主归属沿用 #95，列表/详情的访问范围见下节。历史 demo-owner 需求不自动转移；显式排期查询的独立归属校验见 GET /api/schedule。match 等其他读取接口仍需审计，不能宣称整个模块或平台已经完成权限隔离。

## GET /api/demand 与 GET /api/demand/[id]：访问隔离

不接受任何查询参数（包括 ownerId、providerId、role、status、分页和重复参数）；非法参数/空白 ID 返回 400/VALIDATION_ERROR。非空路径 ID 原样精确查找，不 trim。继续返回公共 Demand[] / Demand。

在同一个 Serializable 事务中验证持久化会话、当前角色/绑定、执行受限 SQL 并校验输出。列表：有效业主 cookie 只返回本人全部状态；没有业主 cookie 时按 published 过滤，匿名无需服务方登录即可访问，包含已发布的 demo-demand。详情：published 对所有访问者可读，非 published 仅所属业主可读；其他人与不存在统一 404/DEMAND_NOT_FOUND。匿名响应仍使用公共 Demand，不包含 ownerId 等业主信息；管理员尚无全量入口。

存在但伪造、重复、过期或撤销的业主凭证为 401/UNAUTHENTICATED；有效业主凭证对应当前角色不再是 owner 为 403/FORBIDDEN。这两条也适用于已发布详情。双 cookie 时业主优先，无效业主不能回退匿名或服务方。没有业主 cookie 时，演示服务方关闭/过期/撤销/绑定变化不妨碍访问 published 数据；它也不能授予非公开需求权限。角色导航及自报身份不能扩大权限，合法空结果才返回 200 空数组。

逐条 source 保持 demo-demand 为 mock、其他数据库需求为 live。普通匿名和业主整体含 demo-demand 时为 mock，否则 live（含空列表）；有效演示服务方会话整体仍为 mock，该会话只影响来源标识。所有响应 Cache-Control: private, no-store、Vary: Cookie；存储、坏 DTO 或越界查询结果统一 503/DATABASE_UNAVAILABLE，不回退 mock 或空成功。A/B/C 使用原 URL/DTO，C 大厅、管理页与匹配页可继续匿名获取 published 数据。完整交接与验证见 docs/requests/D-demand-read-auth.md。
