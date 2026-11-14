# D：需求列表与详情的身份隔离

- 状态：已实现，定向测试、check、build 和 D scope 通过。
- 基线：origin/main b7b08e4（已含 DELETE #91 和登录限流 #93）；独立于 POST 归属 #95、本人报价 #98。
- 原因：GET /api/demand 与 GET /api/demand/[id] 原先无鉴权，列表返回全部账号的数据，详情仅按 ID 查询。

## 字段、权限及来源

继续使用公共 Demand、DemandIdParams、envelope(Demand / Demand[])，不增加字段、依赖或 schema。两个 GET 均不接受查询参数，包括 ownerId、providerId、role、status、分页等；非空路径 ID 原样精确查找，不 trim。

在一个 Serializable 事务中验证持久化会话、当前账号角色/绑定，再执行受限 SQL 并校验输出：

- 存在业主 cookie 时只尝试业主身份；有效业主可读本人所有状态的需求。他人与不存在的详情均为同一 404，列表直接按 ownerId 过滤。
- 没有业主 cookie 时，可用已开启的有效演示服务方会话读取需求大厅：只允许 published；草稿、已签约、施工中、已完成均不可见。演示服务方不是生产认证，暂不开放已接单详情或管理员权限。
- 两种 cookie 同时存在时业主优先；无效、重复、过期或撤销的业主 cookie 返回 401，不回退服务方。当前业主角色变更为其他角色返回 403。需要浏览服务方大厅时先退出业主登录；角色导航不改变授权。
- 匿名、失效或关闭的演示会话返回 401；demo-demand 也不作为匿名兜底。合法空列表返回 200，不能将故障伪装为空数组。
- 每条 Demand.source 保留数据库需求 live / 固定 demo-demand mock。业主查询整体在含 demo-demand 时为 mock，否则为 live（包括已授权空列表）；演示服务方查询整体始终为 mock，明确演示身份来源。
- 所有成功/失败响应 private, no-store、Vary: Cookie。存储、会话读取、越界数据库返回或 DTO 验证异常统一 503/DATABASE_UNAVAILABLE，无内部错误泄漏。

## 调用方影响及界限

A 的本人列表/详情、B 的需求详情读取保持 URL 与 DTO，必须先业主登录。C 的大厅/详情先演示服务方登录，仅返回已发布需求；C 管理页面不再享有匿名全量读取权限。鉴权错误交调用方显示，不能转为成功或 mock。D 不修改 A/B/C 私有页面；登录后自动刷新与身份提示由各负责人接入。

本次只保护两个需求 GET。供 B 内核复用的 findDemand/listDemands 不改签名；match、schedule 等其他接口仍需逐项审计，不能据此宣称全平台已隔离。历史 demo-owner 需求不转移；#95 合入前原 POST 仍不能创建当前账号所属需求。

## 验收

隔离 SQLite 和合成账号覆盖两业主所有状态与跨业主 404、服务方仅 published、匿名/过期/撤销/角色/绑定变化、双 cookie 优先级、精确 ID、未知参数、来源、合法空列表、存储与坏 DTO 失败；公开路由通过真实密码登录和演示登录验证读取及退出失效。执行 check、build、D scope，记录实际结果后提交 PR。

已执行：13 项定向测试通过，完整 `npm run check` 552/552、`npm run build`、`npm run scope -- --role D --base origin/main`（8 个 D 文件）及 diff 检查通过。只使用隔离临时数据库和合成账号；身份、查询及会话使用实际实现，故障注入仅在专门测试中进行。公开 GET 已通过真实密码/演示登录处理器联验；本 PR 未单独做浏览器手工验收。生产服务方认证、管理员范围以及其他 API 的隔离未实现。
