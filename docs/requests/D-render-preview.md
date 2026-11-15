# 线上预览部署

项目使用现有 Next.js 服务和 SQLite。线上预览建议使用 Render Singapore 的付费 Web Service，并挂载 1GB persistent disk 到 `/var/data`。SQLite 文件必须放在持久盘，Render 文档说明免费 Web Service 不保留本地文件，付费服务才可挂载 persistent disk。该服务固定单实例，避免 SQLite 并发写入冲突。

仓库根目录的 `render.yaml` 已准备好构建、启动、健康检查和环境变量。它不会包含模型密钥：Render 创建服务时会提示填写 `LLM_API_KEY`，密钥只保存在 Render 的服务器环境变量中。`AI_MODE=live`、`LLM_BASE_URL` 和 `LLM_MODEL` 已按当前模型服务配置；如果中转站或模型名变化，只修改 Render 环境变量，不改仓库。

## 首次创建

1. 登录 Render，选择 **New → Blueprint**，连接 `LZX-PQZ/ai-home-platform`。
2. 选择 `main` 和仓库根目录的 `render.yaml`，区域保持 Singapore，计划选择 Starter。
3. 创建前在环境变量提示中填入 `LLM_API_KEY`。不要把密钥写进 GitHub、`render.yaml` 或聊天。
4. 创建并等待构建完成。启动命令会在挂载盘上执行 `npm run db:setup`，然后启动 Next.js；数据库不会写入仓库目录。
5. 用 Render 提供的 `https://<service>.onrender.com` 地址验收 `/owner/demand/chat`。首次部署会创建空数据库并运行 seed，公开演示数据仍按页面来源标识显示。

## 限制

SQLite 持久盘只支持单个 Web Service 实例；增加实例前必须迁移到托管 PostgreSQL 并调整 Prisma 配置。服务重部署时会有短暂不可用窗口。真实 AI 调用产生的费用、速率和可用性由中转站承担。照片和数据库只保存在该服务的持久盘，尚未接入对象存储或备份导出。

本地 `npm run dev` 仍然可以使用 mock；线上通过服务器环境变量使用 live。部署完成后，访问者只需打开同一个 Render URL，不需要在自己的电脑配置模型密钥。
