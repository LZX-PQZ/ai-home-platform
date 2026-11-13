# 当前交付状态
## 已提供
- 原方案目录、Next.js/TypeScript/Tailwind 开工骨架。
- 三端入口及 A/B/C 页面占位、样例需求/匹配/报价/进度展示。
- Zod 公共数据契约、mock 来源标识、模拟 API 和输入校验示例。
- Prisma 八个数据模型及可重复执行的 seed。
- 四人任务说明和给 AI 的可复制提示词。
- 角色文件检查、模块导入检查、测试、GitHub Actions、PR 模板。

## 尚未完成
- 真实 AI 对话/模型适配、报价完整 CRUD。
- 服务方鉴权/多租户隔离、真实的双端数据联动。
- 动态排期与异常调整、照片检查、评价回流、售后闭环。
- 真实支付/资金托管（本次只计划模拟）。
- CODEOWNERS 真实成员账号、成员邀请；GitHub 分支保护受当前私有仓库套餐限制，未开启（详见 docs/GITHUB.md）。

需求 GET/POST/详情接口已读取或写入 Prisma；仅 seed 的 `demo-demand` 会标记为 mock，用户创建记录标记为 live。其他 GET API 仍以固定 mock 响应。
动态页面当前使用固定样例，不代表任意 ID 已正确实现。

## 本地验证记录（2026-11-13）
- npm run check：lint、TypeScript、8 个测试、模块导入边界通过。
- npm run db:setup：新建 SQLite 数据库、建表和种子数据成功。
- npm run build：生产构建成功。
- 启动生产服务后运行 node scripts/smoke.mjs：13 个页面、8 个 GET 接口、3 个 POST 场景通过。
- 分工检查实测：A 的文件对 A 放行，对 B 拒绝。
