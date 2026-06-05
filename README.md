# 天工助手

基于 RAG（检索增强生成）的 OneNote 个人知识库助手 —— 微信小程序

将你的 OneNote 笔记转化为可自然语言问答的私人知识库，随时随地用中文提问，获得带来源引用的精准回答。

## 功能特性

- **OneNote 同步** — 通过 Microsoft Graph API 自动拉取笔记本，支持按笔记本粒度同步
- **智能分块** — 按 Markdown 标题切分，500 字分块 + 50 字重叠，避免语义截断
- **向量检索** — DeepSeek embedding + Supabase pgvector，余弦相似度 Top-5 检索
- **RAG 问答** — DeepSeek Chat 生成回答，附带原始笔记来源引用
- **笔记浏览** — 笔记本 → 分区 → 页面三级浏览，支持附件查看
- **同步管理** — 手动/定时同步，同步日志，逐笔记本开关
- **隐私优先** — 所有数据存储在你自己的 Supabase 项目中

## 技术架构

```
┌─────────────┐    ┌──────────────────┐    ┌────────────────┐
│  微信小程序   │───▶│   微信云函数 (9个)  │───▶│  外部服务        │
│  前端 UI     │◀───│  业务逻辑层        │◀───│                │
└─────────────┘    └──────────────────┘    │ • Microsoft    │
                                           │   Graph API    │
                                           │ • DeepSeek API │
                                           │ • Supabase     │
                                           │   (pgvector)   │
                                           └────────────────┘
```

**数据流：**

```
OneNote 笔记 → Graph API → HTML 清洗 → 智能分块 → DeepSeek Embedding → pgvector 存储
                                                                              ↓
用户提问 → DeepSeek Embedding → 向量检索 (Top-5) → 组装 Prompt → DeepSeek Chat → 回答
```

## 快速开始

### 前置条件

- 微信开发者工具 + 小程序账号
- [Supabase](https://supabase.com) 账号（免费）
- [DeepSeek](https://platform.deepseek.com) API Key（充值 ¥10-20）
- [Azure](https://portal.azure.com) 账号（免费，用于 OneNote 授权）

### 部署步骤

1. **Supabase** — 创建项目，执行 `supabase/migrations/` 下的 SQL 文件
2. **Azure** — 注册应用，添加 `Notes.Read` 权限
3. **微信云开发** — 创建集合，配置云函数环境变量，上传部署云函数
4. **运行** — 微信开发者工具编译，设置中连接 OneNote，同步笔记，开始提问

> 详细步骤见 [部署指南](docs/setup-guide.md)

## 项目结构

```
tiangong-assistant/
├── miniprogram/                    # 微信小程序源码
│   ├── pages/
│   │   ├── index/                  # 首页：问答入口
│   │   ├── chat/                   # 对话页：RAG 问答
│   │   ├── notes/                  # 笔记浏览
│   │   ├── note-detail/            # 笔记详情
│   │   ├── sync/                   # 同步管理
│   │   └── settings/               # 设置
│   └── utils/                      # API 封装、存储、格式化
├── cloudfunctions/                 # 微信云函数
│   ├── authDeviceCode/             # OAuth 设备码
│   ├── authPollToken/              # Token 轮询
│   ├── syncNotes/                  # 笔记同步（核心）
│   ├── askQuestion/                # RAG 问答
│   ├── getNotebooks/               # 笔记本列表
│   ├── getPages/                   # 页面列表
│   ├── getPageDetail/              # 页面详情
│   ├── getSyncLogs/                # 同步日志
│   └── clearKnowledgeBase/         # 清空知识库
├── supabase/migrations/            # 数据库迁移
├── demo-notes/                     # 示例笔记
├── upload-notes.js                 # Markdown 导入脚本
└── docs/                           # 部署指南、设计文档
```

## 导入笔记

三种方式可选：

| 方式 | 说明 | 适用场景 |
|------|------|---------|
| 自动同步 | OneNote OAuth + Graph API | 有 Azure 账号，长期使用 |
| 手动导入 | `node upload-notes.js <目录>` | 快速上手，Markdown 文件 |
| 演示模式 | `node upload-notes-demo.js demo-notes` | 测试流程，无需 API Key |

> 详见 [导入说明](README-导入笔记.md)

## 成本

| 项目 | 月费用 |
|------|--------|
| 微信云开发 | ¥0（免费额度） |
| Supabase | ¥0（免费 500MB） |
| DeepSeek API | ¥2-5 |
| **合计** | **< ¥5** |

## License

MIT
