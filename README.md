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
本模板不绑定特定 AI 工具；如果工具不自动读 AGENTS.md，必须在开工提示中明确要求读取。
