# B → D：报价查询与提交契约交接

- 申请角色：B
- D 处理状态：待讨论，尚未实现。
- 用户场景：C 提交服务方报价后，A/B 按同一 demandId 查看已提交报价；不能由客户端冒充服务方或决定合计金额。
- 共享文件：src/contracts/index.ts、docs/API.md、D 的鉴权/数据库/查询基础设施、共享 mock 和契约测试。由 D 修改，B 本 PR 不改这些文件。

## 本次可独立交付

B 的报价页验证已知演示需求 ID，只展示该需求的 submitted/accepted 报价。GET /api/quote 沿用当前无参数演示入口和 envelope(Quote[]) 响应；本次不新增查询参数协议。两处均重算已知费用，显示 mock 来源，不接入写入。

已知费用按现有 QuoteItem.amountCents 累加；null 不推算成零或自动用数量乘单价填充。amountCents 或 unitPriceCents 为 null 的项目，以及报价中声明的额外 pendingItems，均保留为待确认。空明细不构成完整报价；已知费用不能直接作为最终总价或最低价。

待确认明细按现有 items[].code 区分，不按名称合并。同名不同编号的两项在公共 pendingItems 名称数组中保留两个条目，页面从明细读取编号并分别展示。重复汇总不会将名称数组再次计为额外项目。现有 pendingItems 中无法对应待确认明细的名称继续保留；该字段没有编号，不能可靠区分同名额外费用与明细，仍需 D 在后续契约中明确关联方式。本次未修改公共字段。

## 请求 D 确认并合入的字段与行为

1. 新增公共 QuoteSubmissionInput，建议必填字段：demandId（复用 Id）、items（至少一项）、estimatedDays（正整数，天）。每项建议复用 QuoteItem 的 code、name、unit、quantity、unitPriceCents、note 字段；金额为人民币分的安全非负整数或 null，数量为有限非负数，code 在同一报价内唯一。字符串长度、数量精度及上限由 D 明确定义。
2. 请求体不接受 providerId、amountCents、knownTotalCents、pendingItems、status。服务端从鉴权身份确定 providerId、确认该身份可报价，再按明细计算金额和待确认项，状态设为 submitted。
3. 请明确小数数量乘整数分的舍入规则（建议逐项四舍五入到分后求和），约束安全整数范围，并确定固定套餐金额如何表达；未确认规则前 B 不自行推算现有明细金额。
4. 提供授权的报价持久化服务，返回现有 envelope(Quote)；明确重复提交是新版本、更新还是 409，保证原子写入与失败不落库。C 的表单使用同一个公共输入契约。
5. 提供按 demandId 读取需求与报价的服务或 API，建议 GET /api/quote?demandId=... 返回 envelope(Quote[])；已知需求暂无报价时为 []，未知需求 404，非法参数 400，无权限按 D 的统一约定处理。业主只读 submitted/accepted，草稿和已拒绝报价不进入当前对比。
6. 与已有 B-demand-query.md 一并明确需求和服务方名称查询的来源。真实查询失败不得回退为模拟成功；仅完整数据链路接通后标 live。

## 建议请求示例（待 D 确认，不代表接口已支持）

```json
{
  "demandId": "demo-demand",
  "estimatedDays": 25,
  "items": [
    {"code":"bathroom","name":"浴室改造套餐","unit":"job","quantity":1,"unitPriceCents":1200000,"note":"范围需现场确认"},
    {"code":"haul","name":"垃圾清运","unit":"job","quantity":1,"unitPriceCents":null,"note":"待补充"}
  ]
}
```

成功响应复用 envelope(Quote)：服务端生成 id、providerId 和 submitted 状态，计算 knownTotalCents=1200000，保留清运的 null 单价/金额及 pendingItems=["垃圾清运"]。来源必须反映实际持久化和查询链路。

## 兼容与验收

- 保留现有 Quote 输出字段和无参数演示入口；先合入公共输入类型和服务，再由 B/C 适配各自模块。
- 伪造 providerId、金额合计或状态的请求被拒绝，合法身份只能给有权限的需求报价。
- 提交含未知费用的报价后，C 得到真实成功；A/B 读取相同需求时显示相同明细、已知合计与待确认项。
- 不同需求的报价不混入；空结果、404、权限失败和服务器失败分别处理。
- POST /api/quote 在实际接通前继续返回 501/ok:false，页面不能显示提交成功。
- 档期排序、单位不一致/缺项诊断等 P1 功能不在本次范围。
