# 天工助手 — 部署指南

## 前置要求

- 微信开发者工具（最新版）
- 微信小程序账号（已注册）
- Supabase 账号（免费）
- DeepSeek API Key（充值 ¥10-20 即可）
- Microsoft Azure 账号（免费注册）

## Step 1: Supabase 设置

1. 访问 https://supabase.com 创建项目
2. 记录项目 URL 和 API Keys
3. 进入 SQL Editor，依次执行：
   - `supabase/migrations/001_init.sql`
   - `supabase/migrations/002_rpc.sql`

## Step 2: Azure 应用注册

1. 访问 https://portal.azure.com
2. 进入「Azure Active Directory」→「应用注册」→「新注册」
3. 名称填「天工助手」，受支持的账户类型选「任何组织目录中的账户和个人 Microsoft 账户」
4. 注册后记录「应用程序(客户端) ID」
5. 进入「证书和密码」→「新建客户端密码」，记录密码值
6. 进入「API 权限」→「添加权限」→「Microsoft Graph」→「委托的权限」
   - 添加 `Notes.Read` 权限

## Step 3: 微信云开发设置

1. 用微信开发者工具打开 `miniprogram/` 目录
2. 在 `app.js` 中填入云环境 ID
3. 在云开发控制台创建以下集合：
   - `ms_graph_token` — 存储微软 token
   - `auth_state` — 存储授权状态
   - `note_metadata` — 存储笔记元数据
   - `sync_logs` — 存储同步日志
4. 上传并部署所有云函数
5. 在云函数环境变量中配置：
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `DEEPSEEK_API_KEY`
   - `AZURE_CLIENT_ID`
   - `AZURE_TENANT_ID`

## Step 4: DeepSeek

1. 访问 https://platform.deepseek.com
2. 注册并获取 API Key
3. 充值 ¥10-20（个人使用绰绰有余）

## Step 5: 运行

1. 微信开发者工具 → 编译运行
2. 进入「设置」→ 点击「连接 OneNote」
3. 在浏览器中输入设备码完成授权
4. 回到小程序 → 「同步管理」→「立即同步」
5. 同步完成后即可在首页提问
