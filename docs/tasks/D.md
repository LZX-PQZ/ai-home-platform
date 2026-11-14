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
- [ ] 排期、工单、照片检查与评价的 POST 写入仍为 501；需逐个小功能冻结契约、实现并验收，不能将占位响应视为成功。
- [ ] `match` 等其他读取接口继续审计访问范围；B 的匹配业务仍由 B 维护，需要变更时先提交具体交接请求。

业主会话与报价读取授权见 `docs/requests/D-owner-quote-read-auth.md`。需求 POST 和两个需求 GET 已分别随 #95、#101 合入；本轮补齐显式排期读取，不能宣称整个平台已隔离。服务方履约关系、生产服务方认证与管理员专属范围仍未实现。

## 成员反馈与后续顺序（2026-11-14）

- [x] PR #81 已合入；README 补充拉取 main 后运行 `npm run db:setup` 的提示，本机已执行成功。该同步保留已有记录，历史报价来源回填 mock。
- [x] 业主密码登录、刷新和退出入口；临时合成账号浏览器验收通过，密码认证是真实实现，账号不代表实名认证。B 的报价读取 API/页面合入后仍需联验。
- [x] #95 已合入，#101 公开读取修订已普通合并同步 main dc5d8ef，并重新运行 `npm run db:setup`；检查与生产冒烟结果见 `docs/requests/D-demand-read-auth.md`。后续 D 功能继续依次交付，避免多个 PR 同时修改共享接口文档和需求基础设施。
- [x] C 的服务方身份过滤基础查询：按 `C-provider-orders.md` 允许的最小方案提供 `GET /api/provider/quotes`，复用 Quote[]，在同一事务按实际服务方会话绑定过滤本人报价，拒绝自报身份参数，覆盖匿名/跨服务方/撤销及来源测试。演示身份整体 mock，接线协议见 `docs/requests/D-provider-own-quotes.md`。
- [ ] 真正接单关系与履约查询、生产服务方登录仍未实现；本人报价不等于接单。C 需将页面接到新接口并使用“本人报价”文案，D 不修改 C 页面。

这些是后续独立验收项，本次没有改动 B/C 的业务目录，也没有将服务方演示登录转换为业主身份。

## 报价来源基础设施（2026-11-14）

- [x] Quote.source 非空、默认 mock；公共 Quote 可选 source；固定演示报价显式标 mock。
- [x] 持久化来源严格校验、混合/空列表来源汇总；真实旧表升级、回执关联保留和重复同步测试。
- [ ] B 交接：创建、重放、GET 输出持久化来源并调用汇总工具；这是 PR #79 合入前的必要接入，D 未改写 B 的私有内核。

需求 PUT/DELETE 和 GET 的鉴权已单独记录在上方，POST 由 #95 处理。来源实现及数据库同步见 `docs/requests/D-quote-source.md`。

## 排期写入与后续业务（2026-11-14）

- [x] POST /api/schedule 创建首版手工计划：真实业主为本人 published/contracted 且无排期的需求创建 v1；同源、事务内身份/归属重验、依赖图与工期校验、重复/并发保护、输出失败回滚。持久化结果 live，初始工序均 pending，无责任服务方；不是 AI 排期或施工承诺。见 `docs/requests/D-schedule-create.md`。
- [ ] A 接入初始计划创建表单；排期变更申请/审批、追加版本、状态推进与阶段验收另行定义契约，不能把旧按钮直接当作创建动作。
- [ ] 后续独立交付工单、照片检查、评价的 501 写入接口，以及按归属审计 match 等读取接口。
- [x] #108 已合入；本次接口变化同步修改 scripts/smoke.mjs，交付时确认 CI 的 Production HTTP smoke 成功。
