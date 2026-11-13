# B → D：匹配模块真实需求查询交接

- 申请角色：B
- 状态：D 的需求详情接口已合入；B 匹配页面接入 HTTP 查询，服务端复用与鉴权待 D 处理。
- 用户场景：业主从 A 的需求详情进入匹配页时，需要用同一个 demandId 获取对应需求与服务方，不能总显示 demo-demand。

## B 原演示接口（保留）
- GET /api/match 仍使用 src/lib/match/data.ts 演示数据入口。
- GET /api/match 不带参数保留原演示行为；新增可选 demandId 查询参数。
- demandId=demo-demand 返回现有 Match[] 成功结构，meta.source=mock。
- 显式传入不存在的 ID 返回 404/DEMAND_NOT_FOUND；空、纯空白或重复 demandId 返回 400/VALIDATION_ERROR。
- 页面 /owner/matches/[id] 已改为下述 HTTP 查询，不再使用默认需求数据入口。
- 所有金额、对象、Match[] 和来源字段继续使用 src/contracts，不新增另一套 DTO。

## 2026-11-14：真实需求匹配页面

- 通过共享 apiGet 调用 GET /api/demand/[id] 和 GET /api/provider，分别使用 Demand、Provider[] 校验，再调用现有 matchProviders 规则。
- 实际需求的城市和改造类型参与过滤与排序，返回 ID 必须与当前需求一致；404 展示未找到，501/503/网络/契约错误展示失败并可重试，不回退列表或 demo-demand。
- 页面分别标明需求来源与服务方来源；任一来源为 mock 时整体为 mock。当前 provider 接口仍为 mock，不表示真实服务方或真实 AI 已接通。
- 未知需求的页面外壳 HTTP 为 200，客户端读取需求接口得到 404 后展示未找到；GET /api/match 的原演示 404 行为保持不变。
- 非 demo-demand 不提供会跳入演示报价的入口，明确真实报价查询尚未接通。报价写入仍按 B-quote-submission.md 等待公共契约及基础设施。

## 需 D 调整的服务端复用边界

`src/lib/demand.ts` 已导出 findDemand，但 scripts/check-boundaries.mjs 的 shared 白名单尚未包含该服务，因此 B 的 src/app/api/match/route.ts 导入它会被拒绝。请 D 明确允许 **B 的 API 路由** 调用 findDemand，保留页面/客户端禁止直接导入数据库服务的限制；可添加按导入方路径限定的基础设施规则，或提供获准复用的服务端适配层。不要为此向所有客户端开放 Prisma。

D 合入后 B 将 GET /api/match 切到同一真实需求查询，校验 demandId 后调用 findDemand，按既有状态约定返回 404/503。由 D 同步 docs/API.md 中页面与 API 的实现差异。本次只先交付不依赖边界变更的页面，未改检查脚本或复制需求数据库查询逻辑。

## 需要 D 提供
1. GET /api/demand/[id] 已提供并接入页面；真实身份授权和数据隔离仍待提供。
2. GET /api/provider 已提供 envelope(Provider[])，当前仅 mock；后续提供真实服务方来源和正确访问范围。
3. docs/API.md 已记录 B 演示 API 的 demandId 兼容行为；请同步本次页面接入状态，并处理上述服务端复用边界。
4. 如果后续按预算/档期过滤，请先在共享 Provider 契约中定义业务字段、单位、来源和未确认值，再通知 B；本次不凭空声称满足预算/工期。

## 交接验收
- 新建两个城市/改造类型不同的需求，A 的链接、B 页面和 B API 分别使用各自的 ID。
- 没有权限或不存在的需求不回退到演示需求。
- 查询失败显示失败，不能静默切换 mock 后标注 live。
- 模拟数据保留 mock；只有完整链路的数据来源均已接通才能标为 live。
- 服务端复用边界就绪后，由 B 修改自己的 data.ts 适配层及 API，不要求 D 越界改 B 的业务。

## 本次人工验收入口
- 在 A 创建深圳维修、广州局改需求后，打开各自 /owner/matches/[id]：分别按各自城市/类型匹配，并标明已保存需求与模拟服务方来源。
- /owner/matches/demo-demand：数据库存在该演示需求时显示 2 家深圳施工团队；无此记录则显示未找到，不静默补造。
- /owner/matches/missing-demand：需求未找到。
- /api/match?demandId=demo-demand：200，符合共享 envelope(Match[])。
- /api/match?demandId=missing-demand：404，不返回默认结果。
