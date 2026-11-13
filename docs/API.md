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
| GET /api/demand | Demand[] | D | 查询 Prisma；每条 `Demand` 输出 `source`，列表含 `demo-demand` 时整体仍标 mock |
| POST /api/demand | DemandInput → Demand | D | 校验后写入 Prisma，创建为 published，返回 live；无数据库时 503 |
| GET /api/demand/[id] | Demand | D | 按 ID 查询 Prisma；每条输出 `source`，不存在 404，不回退到 demo-demand |
| POST /api/demand/chat | ChatResult | D | 读取 ChatInput；`AI_MODE=mock` 返回 mock，`AI_MODE=live` 调用服务端 LLM 网关并返回 live |
| GET /api/provider | Provider[] | D | 固定 mock |
| GET /api/match[?demandId=<id>] | Match[] | B | 无参数保留演示入口；`demandId=demo-demand` 返回 mock；未知 ID 404，空/重复参数 400 |
| GET /api/quote | Quote[] | B | 固定 mock |
| GET /api/schedule[?demandId=<id>&version=<n>] | Schedule | D | 无参数为演示 mock；带 `demandId` 读取 Prisma 最新/指定版本 |
| GET /api/payment | Payment[] | D | 模拟节点列表；simulated 必须 true |
| GET /api/ticket | Ticket[] | D | 固定 mock |

## 已预留、当前返回 501
- POST /api/quote：由 B 实现。服务端先检查已验证的服务方身份：未登录先返回 `401 UNAUTHENTICATED`，已登录但不是服务方或未绑定服务方返回 `403 FORBIDDEN`；认证失败时不消费请求体，也不查询需求。写入开放后必须携带 `Idempotency-Key` 请求头（16–128 位 ASCII 字母、数字、`-`、`_`）；同服务方同键同摘要重放原报价，同键不同摘要返回 409 `IDEMPOTENCY_CONFLICT`。通过身份检查后，才依次进行 JSON/输入/需求状态检查。输入契约已由 D 冻结为 `QuoteSubmissionInput`（`demandId`、1–20 行 `items`、`estimatedDays`），不能让客户端自定 provider 身份、行金额、合计金额、待确认项或状态。服务端计价必须与 C 预览一致：数量按千分之一整数缩放，逐行用整数乘法并四舍五入到分后求和；禁止用浮点乘法替代。当前默认认证适配器没有真实会话，因此实际 HTTP 请求通常先返回 401；即使身份、输入和需求检查全部通过，写入尚未实现仍返回 `501 NOT_IMPLEMENTED`。401、403 和 501 都是失败，不能视为报价提交成功；业务接通后必须返回 `envelope(Quote)` 并如实标注 `meta.source`。完整决策见 `docs/requests/D-quote-idempotency.md`。
- POST /api/schedule、/api/ticket、/api/inspect、/api/review：由 D 完成。ReviewInput 已预留；其他写入契约先补齐再让页面提交。
- POST /api/payment：已实现最小模拟确认动作，不做身份校验，任何调用方都可触发演示状态转换。输入为 `PaymentActionInput`，只允许 `pending → confirmed_demo` 一次转换；状态只保存在服务进程内，进程重启后恢复初始演示状态。成功返回 `Payment`，`meta.source` 为 `mock` 且 `simulated` 为 `true`；这不是支付接口，不代表真实付款、资金托管或数据库持久化。
- 单需求详情 GET /api/demand/[id] 已建立；A 可使用返回的 ID 查询，未知 ID 返回 404。

### POST /api/inspect

输入使用公共 `PhotoInspectionInput`：`demandId` 加 1–10 个不重复的 `imageRefs`。客户端不上传二进制、不传入验收状态或排期状态；图片引用由后续服务端图片存储/会话链路解释。

接通真实分析后使用 `envelope(PhotoInspectionResult)`，结果包含 `demandId`、`findings[]`（`imageRef`、`severity`、`message`）、可选服务端 `reviewedAt` 和固定免责声明。当前真实分析尚未接通，合法输入返回 HTTP 501 `NOT_IMPLEMENTED`；坏 JSON/非法字段返回 400。501 不能被页面显示为分析成功或验收通过。

## 服务端身份基础设施

报价服务端可通过 `src/lib/server-auth.ts` 的 `requireProviderIdentity(request, readSession)` 取得当前服务方身份。`readSession` 必须是服务端已验证会话的适配器，返回 `VerifiedSession` 后才会生成绑定的 `providerId`；请求体、角色切换和客户端自带 `providerId` 均不参与认证。

- 没有已验证会话：401 `UNAUTHENTICATED`。
- 已登录但不是服务方，或会话未绑定服务方：403 `FORBIDDEN`。
- 当前默认 reader 不产生演示身份，因此真实认证适配器接入前不能把报价提交标记为成功。
- 报价 API 与报价引擎可复用 `findDemand`；页面和客户端仍禁止直接导入数据库服务。

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
