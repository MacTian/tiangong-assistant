# 天工助手 — 设计规格

> **日期**：2026-05-04  
> **版本**：v1.0  
> **状态**：待评审

---

## 1. 项目概述

**天工助手**是一个微信小程序，将用户的 OneNote 笔记构建为个人知识库，支持自然语言问答。用户日常遇到问题时，可以直接在小程序中提问，系统基于笔记内容给出准确回答。

### 核心能力

1. **OneNote 笔记同步**：自动/手动将 OneNote 笔记同步到云端知识库
2. **智能问答**：基于 RAG（检索增强生成）技术，从笔记中检索相关内容并生成回答
3. **笔记浏览**：在小程序中浏览笔记本结构、查看笔记原文
4. **增量更新**：笔记变更后自动同步，保持知识库最新

---

## 2. 技术架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      微信小程序端                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 首页/问答 │  │ 对话详情  │  │ 笔记浏览  │  │ 同步管理  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ 微信云函数调用
┌──────────────────────────▼──────────────────────────────────┐
│                  微信云开发（云函数）                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ syncNotes    │  │ askQuestion  │  │ getNotes     │      │
│  │ (同步笔记)   │  │ (RAG问答)    │  │ (浏览笔记)   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘      │
└─────────┼─────────────────┼─────────────────────────────────┘
          │                 │
    ┌─────▼─────┐    ┌─────▼──────┐
    │ Microsoft │    │  DeepSeek  │
    │ Graph API │    │  API       │
    │(读OneNote)│    │(embedding  │
    └───────────┘    │ + 问答)    │
                     └────────────┘
          │
    ┌─────▼──────────┐
    │   Supabase     │
    │ (pgvector 向量 │
    │  存储+全文检索) │
    └────────────────┘
```

### 技术选型

| 组件 | 方案 | 费用 |
|------|------|------|
| 小程序前端 | 原生微信小程序（WXML + WXSS + JS） | 免费 |
| 后端逻辑 | 微信云开发云函数 | 免费额度够用 |
| 向量数据库 | Supabase（pgvector 扩展） | 免费 500MB |
| 大模型 | DeepSeek V3 | ~¥2/百万 token |
| OneNote 读取 | Microsoft Graph API | 免费 |
| 笔记存储 | 微信云开发数据库（元数据）+ Supabase（向量） | 免费 |

### 数据流

**同步流程：**
```
触发（定时/手动）
  → 调 Microsoft Graph API 拉取笔记列表
  → 遍历页面获取 HTML 内容
  → 清洗 HTML 为纯文本
  → 按语义分块（~500字/块，重叠50字）
  → 调 DeepSeek embedding API 向量化
  → 存入 Supabase 向量库
  → 记录同步日志
```

**问答流程：**
```
用户提问
  → DeepSeek embedding 将问题向量化
  → Supabase 向量检索（top_k=5，相似度>0.7）
  → 组装 prompt（系统提示 + 相关片段 + 问题）
  → DeepSeek V3 生成回答
  → 返回答案 + 来源引用
```

---

## 3. 模块详细设计

### 3.1 OneNote 同步模块

#### 3.1.1 Microsoft 认证

- 在 Azure Portal 注册应用，获取 Client ID + Client Secret
- 使用**设备码流（Device Code Flow）** 进行 OAuth2 授权（个人账号必须用此方式）
- 权限范围：`Notes.Read`（只读笔记）
- Access Token 存到微信云开发数据库，自动刷新

**授权流程：**
```
用户点击「连接 OneNote」
  → 云函数生成设备码
  → 小程序展示设备码和验证 URL
  → 用户在浏览器打开 URL 并输入设备码
  → 用户用微软账号登录并授权
  → 云函数轮询获取 token
  → 保存 token，标记已授权
```

#### 3.1.2 笔记拉取

Graph API 调用层级：
```
GET /me/onenote/notebooks          → 所有笔记本
  GET /notebooks/{id}/sections     → 笔记本下的分区
    GET /sections/{id}/pages       → 分区下的页面列表
      GET /pages/{id}/content      → 页面 HTML 内容
      GET /pages/{id}/content
        ?$expand=image             → 图片信息（暂不同步）
```

#### 3.1.3 同步策略

| 触发方式 | 频率 | 说明 |
|---------|------|------| |
| 首次全量同步 | 授权后自动 | 拉取所有笔记 |
| 定时增量同步 | 每天 03:00 | 对比 lastModifiedDateTime |
| 手动同步 | 用户点击 | 增量同步 |

**增量同步逻辑：**
- 记录上次同步时间 `lastSyncTime`
- 每次拉取页面时检查 `lastModifiedDateTime`
- 只处理 `lastModifiedTime > lastSyncTime` 的页面
- 已存在的页面：删除旧向量 → 重新分块 → 重新 embedding

#### 3.1.4 HTML 清洗规则

| 原始 HTML | 处理后 |
|----------|--------|
| `<h1>`-`<h3>` | 保留为标题标记 |
| `<p>`, `<span>` | 提取纯文本 |
| `<table>` | 转为纯文本（行列用换行分隔） |
| `<ul>`, `<ol>` | 保留列表结构（`- ` 前缀） |
| `<img>` | 忽略（暂不处理图片） |
| `<a href="...">` | 保留为 `文件名: 链接` 格式 |
| `<script>`, `<style>` | 完全移除 |

### 3.2 文本分块模块

#### 3.2.1 分块策略

```
原始笔记页面（纯文本，可能数千字）
        │
        ▼
┌─────────────────────────────┐
│  ① 按标题边界切分（H1/H2）   │
│  ② 每段按 ~500 字再切分      │
│  ③ 相邻块重叠 50 字          │
│  ④ 过滤空块和过短块（<50字） │
└─────────────────────────────┘
        │
        ▼
   N 个文本块
```

#### 3.2.2 数据模型

**Supabase 表 `note_chunks`：**

```sql
CREATE TABLE note_chunks (
  id          BIGSERIAL PRIMARY KEY,
  content     TEXT NOT NULL,           -- 文本内容（~500字）
  embedding   vector(768),             -- DeepSeek embedding 向量
  notebook    TEXT NOT NULL,           -- 笔记本名称
  section     TEXT NOT NULL,           -- 分区名称
  page_title  TEXT NOT NULL,           -- 页面标题
  page_id     TEXT NOT NULL,           -- OneNote 页面 ID
  page_url    TEXT,                    -- OneNote 页面链接
  modified_at TIMESTAMPTZ,             -- OneNote 最后修改时间
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 向量索引（余弦相似度）
CREATE INDEX ON note_chunks
  USING hnsw (embedding vector_cosine_ops);
```

**微信云开发集合 `sync_logs`：**

```json
{
  "_id": "auto",
  "syncTime": "2026-05-04T03:00:00Z",
  "type": "incremental",
  "added": 3,
  "updated": 12,
  "deleted": 0,
  "totalChunks": 2150,
  "duration": 45,
  "status": "success"
}
```

### 3.3 RAG 问答模块

#### 3.3.1 向量检索

```sql
-- Supabase 向量检索查询
SELECT id, content, notebook, section, page_title, page_url,
       1 - (embedding <=> $query_vector) AS similarity
FROM note_chunks
WHERE 1 - (embedding <=> $query_vector) > 0.7
ORDER BY embedding <=> $query_vector
LIMIT 5;
```

参数：
- `top_k = 5`：返回最多 5 个相关片段
- `similarity_threshold = 0.7`：低于此值的不参考

#### 3.3.2 Prompt 模板

```
你是一个个人知识库助手。根据以下笔记内容回答用户的问题。

规则：
1. 仅基于提供的笔记内容回答，不要编造信息
2. 如果笔记中没有相关信息，请如实说明
3. 回答要简洁、准确
4. 在每个要点后标注信息来源

=== 相关笔记片段 ===

【片段 1】
{chunk_1_content}
来源：《{notebook_1}》/ {section_1} / {page_title_1}

【片段 2】
{chunk_2_content}
来源：《{notebook_2}》/ {section_2} / {page_title_2}

...

=== 用户问题 ===
{question}

请用中文回答。
```

#### 3.3.3 多轮对话

- 上下文窗口保留最近 **5 轮**对话
- 每轮包含：用户问题 + AI 回答 + 使用的笔记片段 ID
- 追问时，优先使用上一轮已检索的片段，必要时补充新检索

### 3.4 笔记浏览模块

#### 3.4.1 数据结构

**微信云开发集合 `note_metadata`：**

```json
{
  "_id": "auto",
  "page_id": "ms-graph-page-id",
  "notebook": "工作笔记",
  "section": "授权系统",
  "title": "安全设计",
  "html_content": "<h1>安全设计</h1><p>设备指纹...</p>",
  "text_content": "安全设计\n\n设备指纹绑定是指...",
  "attachments": [
    { "name": "设计稿.pdf", "url": "https://..." }
  ],
  "modified_at": "2026-05-03T10:00:00Z",
  "synced_at": "2026-05-04T03:00:00Z"
}
```

#### 3.4.2 内容处理

- 文本内容：直接渲染
- 附件：显示文件名和链接，点击用 `wx.openDocument` 或跳转浏览器
- 图片：暂不在笔记浏览页显示（OneNote 中查看）

---

## 4. 小程序页面设计

### 4.1 页面清单

| 页面 | 路径 | 功能 |
|------|------|------|
| 首页 | `pages/index/index` | 提问入口、最近提问、知识库状态 |
| 对话页 | `pages/chat/chat` | 多轮对话界面 |
| 笔记浏览 | `pages/notes/notes` | 笔记本列表 → 分区 → 页面 |
| 笔记详情 | `pages/note-detail/note-detail` | 单篇笔记内容展示 |
| 同步管理 | `pages/sync/sync` | 同步状态、手动触发、同步日志 |
| 设置 | `pages/settings/settings` | OneNote 授权、同步频率、清空知识库 |

### 4.2 页面交互

**首页：**
- 搜索栏：输入问题直接提问
- 最近提问列表：点击可继续对话
- 知识库状态卡片：笔记数、最后同步时间
- 快捷入口：笔记浏览、同步管理

**对话页：**
- 气泡式对话（用户右、AI 左）
- AI 回答附带来源引用（可点击跳转到笔记详情）
- 底部输入栏支持发送
- 点赞/点踩按钮
- 新对话按钮

**笔记浏览页：**
- 两级结构：笔记本 → 分区 → 页面列表
- 可展开/折叠
- 每个页面显示标题和最后修改时间
- 点击页面进入笔记详情

**笔记详情页：**
- 渲染笔记文本内容
- 附件列表（点击跳转）
- 底部按钮：在 OneNote 中打开（跳转 OneNote 页面链接）

**同步管理页：**
- 立即同步按钮
- 同步进度展示
- 同步日志列表（时间、新增/更新数量、状态）
- 笔记本同步开关（可选择性同步某些笔记本）

**设置页：**
- OneNote 授权状态 + 重新授权
- 同步频率设置
- 清空知识库（二次确认）
- 关于信息

---

## 5. 微信云函数设计

### 5.1 函数清单

| 函数 | 触发方式 | 功能 |
|------|---------|------|
| `authDeviceCode` | 小程序调用 | 生成设备码，开始 OneNote 授权 |
| `authPollToken` | 定时轮询 | 轮询获取 token |
| `syncNotes` | 定时触发器 + 小程序调用 | 同步 OneNote 笔记 |
| `askQuestion` | 小程序调用 | RAG 问答 |
| `getNotebooks` | 小程序调用 | 获取笔记本列表 |
| `getPages` | 小程序调用 | 获取分区下页面列表 |
| `getPageDetail` | 小程序调用 | 获取页面内容 |
| `getSyncLogs` | 小程序调用 | 获取同步日志 |

### 5.2 定时触发器

| 触发器 | Cron 表达式 | 关联函数 |
|--------|------------|---------|
| 每日增量同步 | `0 0 3 * * *` | `syncNotes` |
| Token 刷新检查 | `0 */30 * * * *` | `authPollToken` |

---

## 6. 安全与隐私

- OneNote 笔记数据仅存储在用户自己的 Supabase 和微信云开发中
- DeepSeek API 调用仅发送笔记片段，不包含用户个人信息
- Azure 应用注册使用最小权限原则（仅 `Notes.Read`）
- 小程序不存储任何 token，所有敏感数据在云函数中处理

---

## 7. 成本估算

| 项目 | 预估月费 |
|------|---------|
| 微信云开发 | ¥0（免费额度） |
| Supabase | ¥0（免费 500MB） |
| DeepSeek API | < ¥5（个人使用级别） |
| **合计** | **< ¥5/月** |

---

## 8. 开发阶段规划

### Phase 1：基础框架（Week 1-2）
- 小程序项目搭建 + 页面框架
- 微信云开发环境初始化
- Supabase 项目初始化 + 表结构创建

### Phase 2：OneNote 同步（Week 3-4）
- Azure 应用注册 + OAuth 设备码授权
- 笔记拉取 + HTML 清洗 + 分块
- Embedding 写入 Supabase
- 定时同步 + 手动同步

### Phase 3：问答功能（Week 5-6）
- 向量检索
- RAG prompt 组装 + DeepSeek 问答
- 多轮对话
- 来源引用

### Phase 4：笔记浏览（Week 7）
- 笔记本/分区/页面列表
- 笔记详情展示
- 附件跳转

### Phase 5：打磨上线（Week 8）
- UI 优化
- 错误处理
- 加载状态
- 小程序审核提交

---

## 9. 风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| Microsoft token 过期 | 同步失败 | 自动刷新 + 小程序提醒重新授权 |
| 笔记量超大（>500MB向量） | Supabase 免费档不够 | 升级为付费档或清理旧笔记 |
| DeepSeek API 限流 | 问答超时 | 重试机制 + 降级提示 |
| 小程序审核不通过 | 延迟上线 | 确保内容合规，准备申诉材料 |
