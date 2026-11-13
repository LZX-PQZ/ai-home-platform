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
契约变更必须同步调用方、mock、测试。浏览器调用可使用 apiGet(path, Schema)。

## 已提供的接口
以下 GET **均返回固定演示数据**，不读取数据库，不按 query 或路径中的 ID 做真实筛选。查询参数在 D/B 实现之前不得宣称有效。
| 方法/路径 | data 对应契约 | 负责 | 当前状态 |
|---|---|---|---|
| GET /api/health | service、stage | D | 可用 |
| GET /api/demand | Demand[] | D | 固定 mock |
| POST /api/demand/chat | ChatResult | D | 读取 ChatInput，固定追问，来源 mock |
| GET /api/provider | Provider[] | D | 固定 mock |
| GET /api/match | Match[] | B | 固定需求上的城市/工种过滤与评分排序 |
| GET /api/quote | Quote[] | B | 固定 mock |
| GET /api/schedule | Schedule | D | 固定 mock |
| GET /api/payment | Payment[] | D | 固定 mock；simulated 必须 true |
| GET /api/ticket | Ticket[] | D | 固定 mock |

## 已预留、当前返回 501
- POST /api/demand：后续使用 DemandInput，返回 Demand；由 D 实现写入。
- POST /api/quote：由 B 实现。报价提交输入类型需先和 D 确定，再添加契约；不能让客户端自定 provider 身份/合计金额。
- POST /api/schedule、/api/payment、/api/ticket、/api/inspect、/api/review：由 D 完成。ReviewInput 已预留；其他写入契约先补齐再让页面提交。
- 单需求详情 GET /api/demand/[id] 尚未建立，由 D 添加；A 先使用固定 demo-demand，不能自行拼新接口。

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

## 需求 CRUD 冻结契约（路由实现待后续 PR）

对应请求：docs/requests/D-demand-contracts.md。以下是约定，不表示接口已可调用。

| 方法 | 输入 | 成功返回 | 当前实现 |
|---|---|---|---|
| POST /api/demand | DemandInput | 201 envelope(Demand)，初始 draft | 501 |
| GET /api/demand/[id] | DemandIdParams | 200 envelope(Demand) | 尚未建立 |
| PUT /api/demand/[id] | DemandIdParams + DemandUpdateInput | 200 envelope(Demand) | 尚未建立 |
| DELETE /api/demand/[id] | DemandIdParams | 200 envelope(DemandDeleteResult) | 尚未建立 |

PUT 完整替换可编辑字段，全部必填，不提供 PATCH。创建/更新禁止客户端设置 id、status 或未知字段；description/city 去除首尾空白后不可为空，面积为有限正数，预算为非负安全整数分且下限不超过上限。更新/删除仅允许 draft，其他状态返回 409/INVALID_STATE；不存在返回 404/DEMAND_NOT_FOUND，非法输入返回 400/VALIDATION_ERROR。删除结果为 {id,deleted:true}，仍须包含来源信封。

后续真实路由必须实现鉴权与数据隔离，不得将查询失败回退成 mock。当前 GET 列表、聊天仍为 mock；本次没有实现数据库写入、真实查询或状态流转。
