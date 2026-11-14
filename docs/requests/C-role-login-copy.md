# 三端登录配套页面说明

基于 main e3d5774，保留 #176 的共享样式与折叠说明。配合 D 三端密码登录 PR 使用；应在该认证 PR 合入后合并。

仅修改需求大厅、运营概览、需求详情及售后工单的登录说明，以及相应既有测试。服务方使用服务方账号，运营使用运营账号；不再提示去退出页面中不存在的业主登录栏。仍明确模拟来源、公开需求范围、非公开需求和全量工单/处理权限未开放。业务逻辑、契约、API 和权限范围保持现状。

## 验证

`npm run check`：1020/1020 通过；`npm run build` 通过；隔离库运行 `scripts/run-production-smoke.mjs`（实际调用 `scripts/smoke.mjs`）通过；`npm run scope -- --role C --base origin/main`：9 个文件通过；`git diff --check` 通过。初次 check 未指定已同步数据库，4 个鉴权测试返回 503；配置独立测试库并 db:setup 后全量复跑通过。
