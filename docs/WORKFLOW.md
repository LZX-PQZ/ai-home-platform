# 四人用 AI 的工作流程
每人自己 clone，一人一个角色。不要在四台机器各生成一个新项目；不要把文件压缩包互相覆盖。

## 第一次演练
1. 启动成功。
2. 从 main 建 feature/角色-hello。
3. 只在 docs/tasks/自己角色.md 增加一条本机启动结果。
4. 跑检查、提交、push、开 PR，由 D 合并。
5. 四个人都完成演练后，再做功能。

## 开始新任务（以 A 为例）
先确保 git status 没有未处理改动；有改动就先保存到当前功能分支。
```bash
git switch main
git pull --ff-only origin main
git switch -c feature/A-demand-chat
```
不要直接在 main 写代码。每个小功能用一个短期分支，避免持有 28 小时的大分支。

## 开发中的同步
```bash
git fetch origin
git merge origin/main
```
出现冲突先检查归属；不要 reset --hard、强推或整文件覆盖。合并前保存当前改动。
同步后重跑受影响的检查。

## 提交与 PR
```bash
npm run check
npm run build
npm run scope -- --role A --base origin/main
git status --short
git add 本次明确修改的文件
git commit -m "feat(owner): 完成需求澄清页面"
git push -u origin feature/A-demand-chat
```
GitHub 页面点 Compare & pull request，base 选 main。
提交前检查 diff；不要用 git add . 把密钥或无关改动混进去。
D 审阅 PR 的行为、接口兼容性与演示效果，CI 通过后合并；不要只看 AI 说“已完成”。

## AI 每次结束应交付
- 改了哪些文件、分别解决什么问题。
- 如何打开和验收；命令是否实际通过。
- 当前使用真实模型还是 mock，哪些功能尚未完成。
- 是否需要其他角色变更契约，是否存在越界文件。
- 提交/PR 链接，或明确尚未提交。

## 检查机制的限度
scope 检查角色与文件归属；boundaries 检查静态及字符串动态导入。它们不是权限隔离，也不能证明业务正确。
CI 失败不会自动阻止合并，除非仓库规则明确要求 CI 通过。
CODEOWNERS 尚未填真实用户名，不会自动分配审阅者；由 D 在成员加入后完善。
若其他 AI 不会自动读 AGENTS.md，把提示词中的读文件要求保留，不要只说“帮我完成 A”。
