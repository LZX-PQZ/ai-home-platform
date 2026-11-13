# B → D：匹配模块真实需求查询交接

- 申请角色：B
- 状态：待 D 处理；本 PR 不修改公共契约、数据库或 D 的接口。
- 用户场景：业主从 A 的需求详情进入匹配页时，需要用同一个 demandId 获取对应需求与服务方，不能总显示 demo-demand。

## B 本次已实现
- 匹配规则、页面、GET /api/match 共用 src/lib/match/data.ts 数据入口。
- GET /api/match 不带参数保留原演示行为；新增可选 demandId 查询参数。
- demandId=demo-demand 返回现有 Match[] 成功结构，meta.source=mock。
- 显式传入不存在的 ID 返回 404/DEMAND_NOT_FOUND；空、纯空白或重复 demandId 返回 400/VALIDATION_ERROR。
- 页面 /owner/matches/[id] 同样检查 ID；不拿默认需求冒充其他真实需求。
- 所有金额、对象、Match[] 和来源字段继续使用 src/contracts，不新增另一套 DTO。

## 需要 D 提供
1. 提供读取单份需求的稳定服务或 GET /api/demand/[id]，返回 envelope(Demand)，不存在时 404；使用真实身份做授权和数据隔离。
2. 确认 GET /api/provider 或服务端查询返回 envelope(Provider[])，保证来源和访问范围正确。
3. 在 docs/API.md 记录 B 已实现的 demandId 兼容行为；约定真实查询的错误处理与异步调用方式。
4. 如果后续按预算/档期过滤，请先在共享 Provider 契约中定义业务字段、单位、来源和未确认值，再通知 B；本次不凭空声称满足预算/工期。

## 交接验收
- 新建两个城市/改造类型不同的需求，A 的链接、B 页面和 B API 分别使用各自的 ID。
- 没有权限或不存在的需求不回退到演示需求。
- 查询失败显示失败，不能静默切换 mock 后标注 live。
- 模拟数据保留 mock；只有完整链路的数据来源均已接通才能标为 live。
- D 的公共查询能力合并后，由 B 修改自己的 data.ts 适配层及相关页面/API，不要求 D 越界改 B 的业务。

## 本次人工验收入口
- /owner/matches/demo-demand：2 家深圳施工团队、匹配理由、评分、模拟标识。
- /owner/matches/missing-demand：需求未找到。
- /api/match?demandId=demo-demand：200，符合共享 envelope(Match[])。
- /api/match?demandId=missing-demand：404，不返回默认结果。
