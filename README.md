# AI 家装履约撮合平台
四人 / 28 小时 / Web。按团队提供的 [总方案](方案参考.md) 搭建。
目标链路：需求澄清 → 服务方匹配 → 报价透明 → 施工排期 → 评价/售后。
**当前是已划分职责的开发起点，不是完整产品。页面及 GET 接口以模拟数据为主；真实 AI、业务写入、鉴权待实现。**

## 每位成员从这里开始
1. 每人 clone 自己的一份仓库；不要共用同一个工作目录。
2. 指定 A/B/C/D 角色，把下面对应提示词整段交给 AI。
3. AI 先读根目录 AGENTS.md，再读自己的任务书。
4. 基于最新 main 建 feature/角色-任务 分支，小功能完成就提 PR，D 负责集成。

| 角色 | 按原方案负责 | 开工提示词 | 任务书 |
|---|---|---|---|
| A | 业主端、需求澄清 UI、进度和付款展示 | [复制 A 提示词](docs/prompts/A.md) | [A 的任务](docs/tasks/A.md) |
| B | 匹配、报价页面、接口与逻辑 | [复制 B 提示词](docs/prompts/B.md) | [B 的任务](docs/tasks/B.md) |
| C | 服务方端、管理端、售后 UI | [复制 C 提示词](docs/prompts/C.md) | [C 的任务](docs/tasks/C.md) |
| D | 数据库、后端基础、AI 封装、公共契约与集成 | [复制 D 提示词](docs/prompts/D.md) | [D 的任务](docs/tasks/D.md) |

**建仓库和分目录不能消除接口问题。** 本仓库用共同契约、固定 mock、独立分支和 CI 检查减少冲突；仍由人确认业务接口与合并结果。

## 首次启动
推荐所有人统一 Node.js 22 LTS，使用同一 package-lock.json。
PowerShell（Windows）：
```powershell
git clone https://github.com/LZX-PQZ/ai-home-platform.git
cd ai-home-platform
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run db:setup
npm.cmd run dev
```
macOS / Linux：使用 npm 而非 npm.cmd，使用 cp .env.example .env。
访问 http://localhost:3000 。无 API key 也能启动。不要覆盖已有 .env。
数据库仅本机使用，默认 prisma/dev.db，不提交、不跨成员同步。

已有项目拉取包含 PR #81 的 main 后，也需要运行一次 `npm run db:setup`（PowerShell 使用 `npm.cmd run db:setup`），再重启应用。该变更新增 `Quote.source`；同步会保留已有记录，将历史报价来源保守回填为 `mock`，重复 seed 不覆盖现有记录。未同步的旧库查询报价可能因缺少该列而失败。使用现有 `.env` 即可，无需重新复制或重置数据库。

照片上传后端新增 `sharp` 依赖与 `InspectionImage` 表，更新到包含该功能的分支后运行 `npm ci`、`npm run db:setup` 并重启（PowerShell 使用 `npm.cmd`）。上传入口 `POST /api/inspect/images` 仅接受当前业主本人需求的 JPEG/PNG，保存标准化内容并返回 24 小时有效的引用。照片保存为 live，AI 辅助分析仍为 501；A 页面上传接线尚未完成，现有文件名不能作为已上传引用。照片仅存本地 SQLite，没有公开图片 URL；到期立即停止引用，后续成功上传清理本人过期记录。详见 [上传交接](docs/requests/D-photo-image-upload.md)。

评价后端已提供 `POST /api/review` 和 `GET /api/review?demandId=…`，更新后运行 `npm.cmd run db:setup` 同步评价接单关联与来源列，再重启；历史评价保留，不自动补造成真实接单评价。仅所属业主可对需求与接单均已完成的实际关系提交一次评价，来源沿用接单，mock 不升级。详见 [评价交接](docs/requests/D-review-create.md)。

履约后端新增 `POST /api/order/progress`，业主明确确认后，需求与接单在同一事务中“已签约→施工中→已完成”。有排期时按依赖逐项开工/确认完成，保留历史版本，全部完成才允许整单完成；无排期也须显式确认。运行 `npm.cmd run db:setup` 同步操作记录表后重启。生产 HTTP 冒烟已通过正常接口推进到评价，不再直接改库伪造完工。A/C 的按钮及评价表单仍待接线，专业验收、返工/阻塞和付款联动未实现。详见 [履约交接](docs/requests/D-order-progress.md)。

## 接单数据同步

接受报价与接单后端已提供 `POST /api/order` 和 `GET /api/provider/orders`，部署本功能前运行 `npm.cmd run db:setup` 同步新增的 ServiceOrder 表，然后重启应用；不要重置数据库。既有需求、报价及提交回执保留，历史 accepted 报价不自动补成接单。B 的接受按钮与 C 的实际接单页面已随 #121/#122/#125 合入；履约动作按钮仍待接线。本版一需求只能接受一份报价，含待定费用的报价不会被宣称已确认最终总价。演示报价建立的关系仍标 mock，不代表生产服务方认证、付款或履约完成。协议见 [接受报价交接](docs/requests/D-quote-acceptance.md)。

## 演示服务方登录

在已有 `.env` 中设置 `DEMO_AUTH_ENABLED="true"`，运行 `npm.cmd run db:setup` 同步会话表与演示账号，再重启应用。点击导航下方的“演示服务方登录”，即可使用固定的 `provider-a` 演示身份；无需填写或提交真实账号密码。默认关闭，界面和接口均明确标记模拟来源。

会话有效期 30 分钟，刷新后可读取，点击“退出演示登录”会撤销会话。上方角色切换只切换导航。报价 POST 已接入预检及事务内演示会话读取：同源有效 cookie 对非演示、已发布数据库需求的合法首次提交返回 201，同键同内容且当前授权有效的重放返回 200；报价及幂等回执实际落库，两种回执均标记 `meta.source: mock`。匿名、过期或退出后的请求仍返回 401。mock 表示演示身份，不代表生产认证或业主已收到报价；演示需求仍只读。接口和接入步骤见 [演示会话交接](docs/requests/D-demo-provider-session.md)。

## 业主账号登录

拉取本功能后先运行 `npm.cmd run db:setup` 同步密码凭证及限频表，再由维护者在本机交互终端运行 `npm.cmd run owner:create`（macOS/Linux 用 `npm`）。按提示输入登录账号、显示名称和两次密码；密码需 15–128 字符，终端不回显，不能通过命令参数或管道传入。该命令只创建新业主，不给 `demo-owner` 设置密码，也不覆盖已有账号；没有默认密码或公开注册接口。

启动应用后，点击全局导航下方的“业主登录”。密码验证通过后可刷新保留会话，30 分钟到期需重新登录；“退出业主登录”会撤销当前会话。使用 HTTPS 或本地 `http://localhost:3000` / `http://127.0.0.1:3000`，普通局域网 HTTP 地址会被拒绝；cookie 始终保留 Secure、HttpOnly 和 SameSite=Strict。登录次数含成功及失败：每账号 15 分钟最多 5 次、全局 5 分钟最多 60 次，超限会提示稍后重试。账号认证成功标 `live`，表示实际验证了密码，不代表实名认证。

当前登录业主可创建本人需求，并修改或删除本人可编辑且满足约束的需求。新账号不会自动取得历史 `demo-owner` 需求的归属。匿名需求列表只含已发布需求（包括已发布的 `demo-demand`），不要求演示服务方登录；业主登录后列表返回本人所有状态。已发布详情公开，非公开详情可由所属业主或持有效会话且有本人实际接单关系的服务方读取；失效业主 cookie 返回 401，双 cookie 仍业主优先。服务方列表仍只含已发布需求。页面登录后可刷新/重试，角色切换不改变授权。详见 [需求读取权限](docs/requests/D-demand-read-auth.md)及[接单详情权限](docs/requests/D-provider-demand-access.md)。

B 的报价 API 和页面仍校验业主归属：演示流程请使用 `npm run owner:create` 开通账号，登录后新建需求，再用演示服务方提交报价，最后以原业主身份打开该需求的报价页。固定 `demo-demand` 没有可登录业主，公开需求详情不代表可读取其受保护报价。本次没有交付公开注册、找回密码、MFA 或第三方登录。详细协议见 [业主登录交接](docs/requests/D-owner-login.md)。

## 开工与验收
```bash
git switch main
git pull --ff-only origin main
git switch -c feature/A-demand-chat
npm run check
npm run build
npm run scope -- --role A --base origin/main
```
Windows 如遇 npm.ps1 执行策略限制，使用 npm.cmd，无需修改系统策略。
运行 dev 和 build 时使用不同时间段，避免同时写 .next。

## 文档入口
- [分工与目录归属](docs/OWNERSHIP.md)
- [接口契约与当前实现状态](docs/API.md)
- [Git/AI 协作流程](docs/WORKFLOW.md)
- [28 小时排期与验收](docs/PLAN.md)
- [GitHub 发布及权限设置](docs/GITHUB.md)
- [当前实现与待开发清单](docs/STATUS.md)
- [共享文件变更请求模板](docs/requests/TEMPLATE.md)

## 技术与约束
遵循参考方案：Next.js 14 / React 18 / TypeScript / Tailwind / Prisma / SQLite。
版本和 lockfile 已固定。此版本线用于按方案快速协作；公开部署前需 D 检查维护状态、依赖安全并规划升级。
金额用分，未知费用用 null；模拟来源显式展示。禁止把模拟付款称为真实资金托管。
当前角色导航不是访问控制；本骨架只用于本地/比赛开发，不直接用来承载真实客户数据。
全局视觉 token 位于 `tailwind.config.ts`，共享组件从 `@/components/ui` 引入；页面优先使用 `brand`、`accent`、`ink`、`line`、`canvas` 等语义类名，避免各模块重新定义颜色和尺寸。
本模板不绑定特定 AI 工具；如果工具不自动读 AGENTS.md，必须在开工提示中明确要求读取。
