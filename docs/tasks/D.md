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

- [ ] `PUT /api/demand/[id]`：目前未验证会话及 ownerId。接入经过验证的业主会话，在同一事务按 id + 当前 userId 过滤需求，再检查可编辑状态并更新；匿名、他人及失效会话必须拒绝。不得直接复用允许所有需求状态的报价 GET 授权器。
- [ ] `DELETE /api/demand/[id]`：目前未验证会话及 ownerId。将身份/归属、状态与关联检查、删除放进同一事务；保留演示需求只读规则。增加匿名、跨业主、角色变化、会话撤销和并发修改测试。
- [ ] 业主认证入口与注销：当前只提供持久化会话的签发/读取/撤销基础设施；密码或外部身份验证成功后才能调用 D 的签发函数，注销必须校验同源/CSRF 并清除 cookie。禁止通过客户端 userId/角色切换签发凭证。
- [ ] 需求 POST 与查询隔离：POST 当前固定归属 demo-owner；后续改用当前业主，并确认列表/详情的角色访问范围，避免读取或创建跨用户数据。

本轮只交付业主会话读取及报价读取授权，上述需求写入鉴权尚未修复。具体接口与验收见 `docs/requests/D-owner-quote-read-auth.md`。
