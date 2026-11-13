# A：业主端与需求澄清

## 允许修改
src/app/owner/（排除 matches/quotes）；src/components/ChatWindow.tsx、DemandCard.tsx、GanttChart.tsx；src/features/a/；tests/A-*
精确边界见 docs/OWNERSHIP.md 和 scripts/ownership.mjs。

## P0
先完成需求澄清聊天 UI，调用 POST /api/demand/chat；显示 mock 标识、加载/错误状态、缺失信息；用户确认结构化需求后调用 D 的 POST /api/demand。若该写入仍返回 501，显示未开放，不能伪造保存成功。随后做需求列表、详情，并链接到 B 的匹配/报价页面。

## P1（P0 通过再做）
施工进度、依赖和负责人展示；模拟付款时间线。AI 照片检查只提示疑点，不能声称自动验收合格。

## 验收
聊天可输入、可重试；结构化需求可确认；同一需求 ID 贯穿链接；不存在静默忽略 400/501 的假成功。

## 给 AI 的约束
- 读取 AGENTS.md 和 docs/API.md，使用 src/contracts，不自行声明替代 DTO。
- 未归属的文件只读。需要共享改动写 docs/requests/A-主题.md，交对应负责人处理。
- 模块私有样式和组件放自己目录，不改全局主题和依赖。
- 先列本次文件范围，再实现一个小功能，跑检查并交付；不要一次包揽全部 P1。
- 运行 npm run scope -- --role A --base origin/main。

## 本机演练记录

### 2026-11-13 feature/A-demand-chat（P0：需求澄清聊天）
- 环境：Windows，Node 22.22.2（符合 .nvmrc 22），npm ci 全新安装。
- `npm run check`：lint 通过；tsc --noEmit 通过；17 个测试全过（含 A 新增 9 条）；模块导入边界通过。
- `npm run build`：生产构建成功（/owner/demand/chat 18.9 kB）。
- `npm run scope -- --role A --base origin/main`：通过，8 个变更文件，无越界。
- 运行时验证（next start 后实测）：/owner/demand/chat 返回 200；POST /api/demand/chat 返回 mock 信封与 6 个 missingFields；POST /api/demand 返回 501，页面显示“需求保存尚未开放”，无假成功。
- 使用 mock：对话为 mock 固定追问，未调用真实模型；需求保存依赖 D 的 POST /api/demand。
- 待办（P0 剩余）：需求列表页；详情页接 GET /api/demand/[id]（等 D）；服务方标签映射待 B 联调。
- 已提共享变更请求：docs/requests/A-api-post.md（请 D 新增 apiPost）。
