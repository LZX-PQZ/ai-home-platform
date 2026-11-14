# 当前交付状态
## D 集成更新（2026-11-14）

- #132 业主接单查询、#136 全局过期照片配额修复与 #134 A 照片上传已在 main。
- 本次补齐 `/api/inspect` 模拟返回：有效的本人照片引用返回 200/mock 和固定免责声明，提示明确未分析照片内容；上传为 live。live 分析仍 501，异常/权限失败不回退模拟成功。
- 演示数据维持已有可重复 seed，不为 demo-owner 设置默认密码，不种入用户照片。完整可写链路使用隔离库的合成账号/图片与实际 HTTP；固定 demo-demand 保持只读。
- B #133 第一阶段评价汇总已提供 Provider 可选公共字段及 GET /api/provider 查询，完成接单的评价均分/样本数按 mock/live 分开，公开目录仍为六个演示服务方，无样本不补种子评分。交接与验证见 `requests/D-provider-performance.md`；固定 mock 档期、B 接线、演示报价种子与最终演示步骤待后续。
- 本轮最终集成验证记录见 `requests/D-photo-inspection-mock.md`，包括实际测试、构建和生产 HTTP 冒烟。真实照片 AI、专业验收、生产服务方认证、付款及售后解决闭环仍未完成。

以下保留的是开工骨架阶段的历史记录，当前接口以 docs/API.md 和各角色任务书为准。

## 已提供
- 原方案目录、Next.js/TypeScript/Tailwind 开工骨架。
- 三端入口及 A/B/C 页面占位、样例需求/匹配/报价/进度展示。
- Zod 公共数据契约、mock 来源标识、模拟 API 和输入校验示例。
- Prisma 八个数据模型及可重复执行的 seed。
- 四人任务说明和给 AI 的可复制提示词。
- 角色文件检查、模块导入检查、测试、GitHub Actions、PR 模板。

## 开工时尚未完成（历史）
- 真实 AI 对话/模型适配、报价完整 CRUD。
- 服务方鉴权/多租户隔离、真实的双端数据联动。
- 动态排期与异常调整、照片检查、评价回流、售后闭环。
- 真实支付/资金托管（本次只计划模拟）。
- CODEOWNERS 真实成员账号、成员邀请；GitHub 分支保护受当前私有仓库套餐限制，未开启（详见 docs/GITHUB.md）。

需求 GET/POST/详情/更新/删除接口已读取或写入 Prisma；仅 seed 的 `demo-demand` 会标记为 mock，且演示需求只读，已有报价、排期、付款、评价或工单关联的需求不能删除。用户创建记录标记为 live。其他 GET API 仍以固定 mock 响应。
动态页面当前使用固定样例，不代表任意 ID 已正确实现。

## 本地验证记录（2026-11-13）
- npm run check：lint、TypeScript、8 个测试、模块导入边界通过。
- npm run db:setup：新建 SQLite 数据库、建表和种子数据成功。
- npm run build：生产构建成功。
- 启动生产服务后运行 node scripts/smoke.mjs：13 个页面、8 个 GET 接口、3 个 POST 场景通过。
- 分工检查实测：A 的文件对 A 放行，对 B 拒绝。
