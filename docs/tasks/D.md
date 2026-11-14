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
- [ ] 需求 POST 当前业主归属：由独立 PR #95 修复，历史 demo-owner 数据不自动转移。
- [x] 需求列表/详情隔离：同一事务读取实际身份并限定 SQL；业主仅本人全部状态，演示服务方仅 published。匿名 401，越权详情与不存在统一 404；双 cookie 业主优先，坏凭证不回退。见 `docs/requests/D-demand-read-auth.md`。

业主会话与报价读取授权见 `docs/requests/D-owner-quote-read-auth.md`。密码登录、PUT、DELETE 及 B 报价读取已合入，本轮补齐两个需求 GET 的隔离。POST 由 #95 处理；match/schedule 等其他接口仍需审计，不能宣称整个平台已隔离。

## 成员反馈与后续顺序（2026-11-14）

- [x] PR #81 已合入；README 补充拉取 main 后运行 `npm run db:setup` 的提示，本机已执行成功。该同步保留已有记录，历史报价来源回填 mock。
- [x] 业主密码登录、刷新和退出入口；临时合成账号浏览器验收通过，密码认证是真实实现，账号不代表实名认证。B 的报价读取 API/页面合入后仍需联验。
- [ ] 随后的独立 PR：集成 #95 POST、#98 服务方本人报价；需求 GET 的页面登录后刷新/提示由 A/B/C 接线。生产服务方、管理员授权及其他资源读取范围仍待明确。
- [ ] C 的按服务方过滤接单：C 已提交 `docs/requests/C-provider-orders.md`，D 后续评审接单关系、状态及查询契约。只按服务端会话的 providerId 取本人数据，拒绝客户端自报身份，覆盖匿名/跨服务方/撤销及来源测试。尚未开放新查询参数，C 当前无参数演示列表继续保留明确来源说明。

这些是后续独立验收项，本次没有改动 B/C 的业务目录，也没有将服务方演示登录转换为业主身份。

## 报价来源基础设施（2026-11-14）

- [x] Quote.source 非空、默认 mock；公共 Quote 可选 source；固定演示报价显式标 mock。
- [x] 持久化来源严格校验、混合/空列表来源汇总；真实旧表升级、回执关联保留和重复同步测试。
- [ ] B 交接：创建、重放、GET 输出持久化来源并调用汇总工具；这是 PR #79 合入前的必要接入，D 未改写 B 的私有内核。

需求 PUT/DELETE 和 GET 的鉴权已单独记录在上方，POST 由 #95 处理。来源实现及数据库同步见 `docs/requests/D-quote-source.md`。
