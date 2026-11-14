# D：后端、数据底座、AI 封装与集成

## 允许修改
src/contracts/、prisma/、src/lib 中基础设施、除 match/quote 外的 src/app/api/、src/components/ui/、全局布局/样式、依赖与锁文件、CI 与共享文档；tests 中共享测试
精确边界见 docs/OWNERSHIP.md 和 scripts/ownership.mjs。

## P0
先冻结缺失的写入/详情契约，完成需求 CRUD 与真实查询；维护 Prisma 和 seed；实现 LLM 网关的超时、结构化校验与 mock/live 来源。为 A/B/C 提供 api-client 调用函数和一致错误。B 的 match/quote 业务由 B 实现，D 不越界重写。共享变更先单独 PR 合入，让其他三人同步。

## P1（P0 通过再做）
排期依赖/版本/异常变更确认、模拟付款状态机、评价与售后接口。集成最小链路、负责 CI 与演示版本。

## 验收
无 key 可 mock 启动；真实模型失败明确可见；输入校验不放过无效预算；数据库写入/查询一致；金额和状态由程序校验；CI 通过，三位成员 PR 能分别合入。

## 给 AI 的约束
- 读取 AGENTS.md 和 docs/API.md，使用 src/contracts，不自行声明替代 DTO。
- 未归属的文件只读。需要共享改动写 docs/requests/D-主题.md，交对应负责人处理。
- 模块私有样式和组件放自己目录，不改全局主题和依赖。
- 先列本次文件范围，再实现一个小功能，跑检查并交付；不要一次包揽全部 P1。
- 运行 npm run scope -- --role D --base origin/main。

## 本机演练记录
待本角色成员填写。

## 鉴权待办（2026-11-14，高优先级）

- [x] `PUT /api/demand/[id]`：同源检查、真实业主凭证预检及写事务内重验；按 id + 当前 userId 过滤并校验可编辑状态，最终 SQL 再限制身份/状态。匿名和失效会话拒绝，跨业主与不存在统一 404；输出验证失败回滚。旧的无鉴权更新入口已移除。见 `docs/requests/D-demand-update-auth.md`。
- [x] `DELETE /api/demand/[id]`：同源检查；同一事务验证实际业主会话、归属、状态和五类关联并删除。最终 SQL 再限制归属/状态/空关联，拒绝匿名与跨业主，演示需求只读。隔离 SQLite 覆盖角色/会话变化、并发修改/删除及失败回滚。见 `docs/requests/D-demand-delete-auth.md`。
- [x] 业主密码登录入口与注销：维护者交互开通新账号，随机盐 scrypt 摘要；POST 验证密码后事务内重验角色/凭证并轮换会话，同源退出撤销 cookie。全局共享登录界面、持久化限频和隔离测试已提供。不支持客户端 userId/角色签发；公开注册、找回密码、MFA 和第三方登录仍未实现。见 `docs/requests/D-owner-login.md`。
- [x] 需求 POST 当前业主归属：同源及会话预检、事务内重验后以当前 userId 创建 published 需求；禁止客户端身份字段，移除固定 demo-owner 入口。公开接口验收登录、创建、修改及本人报价读取，另一业主拒绝。见 `docs/requests/D-demand-create-auth.md`。
- [x] 需求列表/详情隔离：同一事务核验当前身份及 SQL 范围；无业主 cookie 时公开列表仅 published，有效业主列表仅本人所有状态。published 详情公开，非公开仅所属业主可读，其余与不存在统一 404。失效业主 cookie 仍 401，不回退匿名。见 `docs/requests/D-demand-read-auth.md`。
- [x] 排期读取隔离及固定演示例外：无参数或精确 DEMO_DEMAND_ID 可公开读取固定种子排期并标 mock，缺版本 404；带失效业主 cookie 即使演示入口也 401。其他需求在同一事务验证实际业主会话与归属，再读取最新/指定版本，匿名 401，仅服务方 403，他人与不存在统一 404；数据库故障不回退 mock。接入及验证见 `docs/requests/D-schedule-read-auth.md`。
- [ ] 照片检查的真实分析仍为 501；评价 POST/GET 已交付本人已完成接单的保存与读取，见下方评价记录。排期首版创建、工单创建已实现，后续状态流转仍需独立定义和验收，不能将占位响应视为成功。
- [ ] `match` 等其他读取接口继续审计访问范围；B 的匹配业务仍由 B 维护，需要变更时先提交具体交接请求。

业主会话与报价读取授权见 `docs/requests/D-owner-quote-read-auth.md`。需求 POST 和两个需求 GET 已分别随 #95、#101 合入；本轮补齐显式排期读取，不能宣称整个平台已隔离。服务方履约关系、生产服务方认证与管理员专属范围仍未实现。

## 成员反馈与后续顺序（2026-11-14）

- [x] PR #81 已合入；README 补充拉取 main 后运行 `npm run db:setup` 的提示，本机已执行成功。该同步保留已有记录，历史报价来源回填 mock。
- [x] 业主密码登录、刷新和退出入口；临时合成账号浏览器验收通过，密码认证是真实实现，账号不代表实名认证。B 的报价读取 API/页面合入后仍需联验。
- [x] #95 已合入，#101 公开读取修订已普通合并同步 main dc5d8ef，并重新运行 `npm run db:setup`；检查与生产冒烟结果见 `docs/requests/D-demand-read-auth.md`。后续 D 功能继续依次交付，避免多个 PR 同时修改共享接口文档和需求基础设施。
- [x] C 的服务方身份过滤基础查询：按 `C-provider-orders.md` 允许的最小方案提供 `GET /api/provider/quotes`，复用 Quote[]，在同一事务按实际服务方会话绑定过滤本人报价，拒绝自报身份参数，覆盖匿名/跨服务方/撤销及来源测试。演示身份整体 mock，接线协议见 `docs/requests/D-provider-own-quotes.md`。
- [ ] 生产服务方登录仍未实现；实际接单关系与履约查询已在下方接单记录交付，C 的接单页面已合入。本人报价不等于接单。

这些是后续独立验收项，本次没有改动 B/C 的业务目录，也没有将服务方演示登录转换为业主身份。

## 报价来源基础设施（2026-11-14）

- [x] Quote.source 非空、默认 mock；公共 Quote 可选 source；固定演示报价显式标 mock。
- [x] 持久化来源严格校验、混合/空列表来源汇总；真实旧表升级、回执关联保留和重复同步测试。
- [ ] B 交接：创建、重放、GET 输出持久化来源并调用汇总工具；这是 PR #79 合入前的必要接入，D 未改写 B 的私有内核。

需求 PUT/DELETE 和 GET 的鉴权已单独记录在上方，POST 由 #95 处理。来源实现及数据库同步见 `docs/requests/D-quote-source.md`。

## 未开工排期确认修订（2026-11-14）

- [x] PUT /api/schedule：本人 published/contracted 需求的最新计划全部 pending、未分配责任方时，显式 confirmed=true、校验 baseVersion 后追加下一版；旧版保留且可读，事务内重验、并发保护与失败回滚。见 `docs/requests/D-schedule-revision.md`。不依赖工单 PR #116。
- [ ] A 的修订表单/差异展示、变更原因/审批审计记录、服务方确认、施工中异常变更与验收仍未实现；业主确认保存不代表他人审批或施工承诺。

未开工手工计划的版本追加已完成；下方变更申请/审批及其版本流转待办仍指完整审批流程。

## 排期写入与后续业务（2026-11-14）

- [x] POST /api/schedule 创建首版手工计划：真实业主为本人 published/contracted 且无排期的需求创建 v1；同源、事务内身份/归属重验、依赖图与工期校验、重复/并发保护、输出失败回滚。持久化结果 live，初始工序均 pending，无责任服务方；不是 AI 排期或施工承诺。见 `docs/requests/D-schedule-create.md`。
- [ ] A 接入初始计划创建表单；完整变更申请/审批及专业阶段验收待后续。未开工修订追加版本与履约工序推进已交付，见对应记录，不能把旧按钮直接当作创建动作。
- [x] 工单 POST 创建 + GET 按本人需求读取：实际业主、同源、事务重验、open/null 初始值、跨业主隔离与失败回滚；固定演示入口仍 mock。见 `docs/requests/D-ticket-create.md`。live 仅表示报告保存，不表示责任认定或售后完成。
- [ ] 工单创建表单、管理员/服务方访问、派单/解决状态流转、通知未实现；本次不修改 A/C 页面。重复提交不去重，失败后需先读取核实。
- [ ] 后续独立交付照片检查的真实分析，以及按归属审计 match 等读取接口；评价及完工流转后端已交付，页面仍待接线。
- [x] #108 已合入；本次接口变化同步修改 scripts/smoke.mjs，交付时确认 CI 的 Production HTTP smoke 成功。

## 接受报价与接单关系（2026-11-14）

- [x] GET /api/order?demandId=…：所属业主在同一事务读取实际接单或明确 null，返回履约/评价所需编号，来源保留、错误不回退空态；无需重放接受报价。契约与 A 接线见 `docs/requests/D-owner-order-read.md`。
- [x] POST /api/order：真实业主同源确认本人 published 需求的 submitted 报价，在事务内重验身份/归属/原始数据并原子签约、接受、建立 ServiceOrder。每需求单一关系，重复同报价返回原关系，竞争报价最多一个成功；保留来源、null 费用和原提交回执。见 `docs/requests/D-quote-acceptance.md`。
- [x] GET /api/provider/orders：当前已验证服务方仅读取本人实际接单；历史 accepted 报价不自动补单。当前演示身份整体仍 mock，逐条保留来源，异常/坏数据不回退成功空态。
- [x] 已接单服务方需求详情：有效会话及本人 ServiceOrder 关系在同一事务核验，签约后可读；匿名和其他服务方仍 404，列表不扩大。见 `docs/requests/D-provider-demand-access.md`。
- [x] 履约推进已在同一事务更新 DemandOrder 与 ServiceOrder，工序动作保留排期版本与操作记录，见下节。
- [ ] 不同幂等键形成多报价是否为预期，由 B 确认业务规则，当前未确认，未擅改报价模块。
- [ ] 生产服务方认证、改选/取消、多服务方拆单、支付未实现；B 接受按钮与 C 接单页面已随 #121/#122/#125 合入，履约动作按钮仍待接线。照片真实分析仍待后续；评价后端见下节。

## 施工照片上传基础（2026-11-14）

- [x] POST /api/inspect/images：当前业主、同源及事务内归属重验，JPEG/PNG 实际解码、旋转去元数据，数量/大小/配额限制，整批原子保存 SQLite，返回 24 小时有效随机引用和 live 来源。
- [x] POST /api/inspect：当前业主及需求/引用归属、有效期、摘要校验；未知/跨归属/过期引用 404，有效引用仍明确 501。来源标记不代表 AI 或验收结论。见 `docs/requests/D-photo-image-upload.md`。
- [ ] A 上传表单接线、真实照片分析、预览/删除管理、后台清理、对象存储与人工复核未实现；评价后端见下节。

## 本人已完成接单的评价（2026-11-14）

- [x] POST /api/review：同源实际业主、事务重验归属/完成状态/accepted 报价关联，每接单一次评价；201 创建、同内容 200 重放、不同内容 409，来源沿用接单，mock 不升级，不改变状态/评分。
- [x] GET /api/review?demandId=…：本人范围、明确空态与错误，历史未绑定/坏关联返回 503。Review.orderId 唯一且保留旧行，source 默认 mock；运行 db:setup 同步。见 `docs/requests/D-review-create.md`。
- [ ] 评价页面、公开评价、服务方评分聚合、审核与通知未实现。正常 API 的开工/完工推进见下节；本轮不修改 A/C 页面。

## 履约推进与评价连通（2026-11-14）

- [x] POST /api/order/progress：所属业主明确确认，需求与接单原子 contracted→in_progress→completed；不跳级/回退，来源保留，失败全部回滚。
- [x] 有排期时按依赖 start_task/complete_task，追加版本并保留历史；全部 done 才能整单完成。实际操作与当前操作者、状态、结果版本同事务记录。见 `docs/requests/D-order-progress.md`。
- [x] 生产 HTTP 链路改为通过接口开工/逐项完成/整单完成/评价，并读取服务方接单列表和详情，不再直接改数据库模拟 completed。
- [ ] A/C 动作按钮、评价表单、双方审批、专业验收材料、实际日期、阻塞/返工/施工中变更、付款联动、操作记录查询待后续。
- [ ] 图中照片两项已核对：照片检查 mock AI 结果尚未提供；全局配额统计仍包括其他业主过期照片，后续单独修复并设计存储回收，不与履约 PR 混合。
