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
契约变更必须同步调用方、mock、测试。浏览器读取可使用 `apiGet(path, Schema)`，提交 JSON 可使用 `apiPost(path, body, Schema)`；失败时客户端保留 `ApiClientError.code/status`。

## 已提供的接口
未特别说明的接口仍返回固定演示数据；需求接口读取 Prisma，匹配接口支持显式 `demandId` 校验。只有文档已记录并通过测试的查询参数才可在调用方使用。
| 方法/路径 | data 对应契约 | 负责 | 当前状态 |
|---|---|---|---|
| GET /api/health | service、stage | D | 可用 |
| GET /api/demand | Demand[] | D | 查询 Prisma；列表含 `demo-demand` 时整体标 mock，仅用户创建记录时标 live |
| POST /api/demand | DemandInput → Demand | D | 校验后写入 Prisma，创建为 published，返回 live；无数据库时 503 |
| GET /api/demand/[id] | Demand | D | 按 ID 查询 Prisma；不存在 404，不回退到 demo-demand |
| POST /api/demand/chat | ChatResult | D | 读取 ChatInput，固定追问，来源 mock |
| GET /api/provider | Provider[] | D | 固定 mock |
| GET /api/match[?demandId=<id>] | Match[] | B | 无参数保留演示入口；`demandId=demo-demand` 返回 mock；未知 ID 404，空/重复参数 400 |
| GET /api/quote | Quote[] | B | 固定 mock |
| GET /api/schedule | Schedule | D | 固定 mock |
| GET /api/payment | Payment[] | D | 固定 mock；simulated 必须 true |
| GET /api/ticket | Ticket[] | D | 固定 mock |

## 已预留、当前返回 501
- POST /api/quote：由 B 实现。报价提交输入类型需先和 D 确定，再添加契约；不能让客户端自定 provider 身份/合计金额。
- POST /api/schedule、/api/payment、/api/ticket、/api/inspect、/api/review：由 D 完成。ReviewInput 已预留；其他写入契约先补齐再让页面提交。
- 单需求详情 GET /api/demand/[id] 已建立；A 可使用返回的 ID 查询，未知 ID 返回 404。

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
Payment 仅 pending/confirmed_demo；不是支付接口。
Ticket 包含 demandId、responsibleProviderId（可空）、category、status。

## AI 接入
当前 AI_MODE=mock。设 live 会明确返回不可用，不静默装作真实 AI。
D 需要实现模型调用、超时、有限重试、JSON 校验与来源追踪。
模型可生成文字解释和候选方案；费用合计、排期依赖和状态合法性由代码复核。
照片只能辅助提示疑点，不能替代现场检测或证明施工合格。
没有经过出题方确认的 API、性能或产品能力不能写成已接通/已验证。

## 需求 CRUD 契约

对应请求：docs/requests/D-demand-contracts.md。POST 创建和 GET 详情已经实现；PUT、DELETE 等待后续路由 PR。

| 方法 | 输入 | 成功返回 | 当前实现 |
|---|---|---|---|
| POST /api/demand | DemandInput | 201 envelope(Demand)，初始 published | 已实现；写入 Prisma，返回 live |
| GET /api/demand/[id] | DemandIdParams | 200 envelope(Demand) | 已实现；按 ID 查询 Prisma，不存在 404 |
| PUT /api/demand/[id] | DemandIdParams + DemandUpdateInput | 200 envelope(Demand) | 尚未建立 |
| DELETE /api/demand/[id] | DemandIdParams | 200 envelope(DemandDeleteResult) | 尚未建立 |

PUT 完整替换可编辑字段，全部必填，不提供 PATCH。创建/更新禁止客户端设置 id、status 或未知字段；description/city 去除首尾空白后不可为空，面积为有限正数，预算为非负安全整数分且下限不超过上限。更新/删除允许 draft 或尚未签约的 published 需求；进入 contracted、in_progress 或 completed 后返回 409/INVALID_STATE。不存在返回 404/DEMAND_NOT_FOUND，非法输入返回 400/VALIDATION_ERROR。删除结果为 {id,deleted:true}，仍须包含来源信封。

后续 PUT/DELETE 路由必须实现鉴权与数据隔离，不得将查询失败回退成 mock。当前需求列表、创建和详情读取 Prisma；聊天仍为 mock；PUT/DELETE 尚未实现，状态流转仍由后续业务层负责。
