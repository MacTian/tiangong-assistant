# 天工助手 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个微信小程序「天工助手」，将 OneNote 笔记同步到云端向量知识库，支持基于笔记内容的 RAG 问答和笔记浏览。

**Architecture:** 微信小程序前端 + 微信云开发云函数后端 + Supabase pgvector 向量数据库 + DeepSeek V3 API（embedding + 问答）+ Microsoft Graph API（OneNote 读取）。全 Serverless，零服务器运维。

**Tech Stack:** 原生微信小程序（WXML + WXSS + JavaScript）、微信云开发（云函数 + 数据库）、Supabase（PostgreSQL + pgvector）、DeepSeek API、Microsoft Graph API

---

## 文件结构总览

```
tiangong-assistant/
├── miniprogram/                    # 微信小程序
│   ├── app.js
│   ├── app.json
│   ├── app.wxss
│   ├── sitemap.json
│   ├── pages/
│   │   ├── index/index.{js,json,wxml,wxss}     # 首页（提问入口）
│   │   ├── chat/chat.{js,json,wxml,wxss}       # 对话页
│   │   ├── notes/notes.{js,json,wxml,wxss}     # 笔记浏览
│   │   ├── note-detail/note-detail.{js,json,wxml,wxss}  # 笔记详情
│   │   ├── sync/sync.{js,json,wxml,wxss}       # 同步管理
│   │   └── settings/settings.{js,json,wxml,wxss}  # 设置
│   ├── components/
│   │   ├── chat-bubble/            # 聊天气泡组件
│   │   ├── source-ref/            # 来源引用组件
│   │   └── sync-status/           # 同步状态组件
│   └── utils/
│       ├── api.js                  # 云函数调用封装
│       ├── format.js               # 格式化工具
│       └── storage.js              # 本地存储封装
├── cloudfunctions/                 # 微信云函数
│   ├── authDeviceCode/
│   │   └── index.js                # 生成设备码授权
│   ├── authPollToken/
│   │   └── index.js                # 轮询获取 token
│   ├── syncNotes/
│   │   └── index.js                # 笔记同步主函数
│   ├── askQuestion/
│   │   └── index.js                # RAG 问答
│   ├── getNotebooks/
│   │   └── index.js                # 获取笔记本列表
│   ├── getPages/
│   │   └── index.js                # 获取分区页面列表
│   ├── getPageDetail/
│   │   └── index.js                # 获取页面详情
│   └── getSyncLogs/
│       └── index.js                # 获取同步日志
├── supabase/
│   └── migrations/
│       └── 001_init.sql            # 数据库初始化 migration
└── docs/
    └── superpowers/
        ├── specs/
        │   └── 2026-05-04-tiangong-assistant-design.md
        └── plans/
            └── 2026-05-04-tiangong-assistant.md
```

---

## Task 1: Supabase 数据库初始化

**Files:**
- Create: `tiangong-assistant/supabase/migrations/001_init.sql`

- [ ] **Step 1: 创建数据库 migration 文件**

创建 `tiangong-assistant/supabase/migrations/001_init.sql`，内容如下：

```sql
-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 笔记分块向量表
CREATE TABLE IF NOT EXISTS note_chunks (
  id          BIGSERIAL PRIMARY KEY,
  content     TEXT NOT NULL,
  embedding   vector(1536),
  notebook    TEXT NOT NULL DEFAULT '',
  section     TEXT NOT NULL DEFAULT '',
  page_title  TEXT NOT NULL DEFAULT '',
  page_id     TEXT NOT NULL DEFAULT '',
  page_url    TEXT,
  modified_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 向量相似度检索索引（余弦距离）
CREATE INDEX IF NOT EXISTS idx_note_chunks_embedding
  ON note_chunks
  USING hnsw (embedding vector_cosine_ops);

-- 按 page_id 查旧数据用
CREATE INDEX IF NOT EXISTS idx_note_chunks_page_id
  ON note_chunks (page_id);

-- 启用行级安全
ALTER TABLE note_chunks ENABLE ROW LEVEL SECURITY;

-- 允许 service_role 完全访问（云函数用）
CREATE POLICY "service_role_all" ON note_chunks
  FOR ALL USING (true);
```

- [ ] **Step 2: 记录 Supabase 配置信息**

在项目根目录创建 `.env.local`（不提交到 git）：

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx
DEEPSEEK_API_KEY=xxxxx
AZURE_CLIENT_ID=xxxxx
AZURE_CLIENT_SECRET=xxxxx
AZURE_TENANT_ID=xxxxx
```

> 实际部署时需要先在 supabase.com 创建项目，然后在 SQL Editor 中执行 migration。此任务只创建 SQL 文件，不执行。

- [ ] **Step 3: 提交**

```bash
cd /home/mac/tiangong-assistant
git init
echo '.env.local' >> .gitignore
echo 'node_modules/' >> .gitignore
git add supabase/migrations/001_init.sql .gitignore
git commit -m "feat: add Supabase migration for note_chunks vector table"
```

---

## Task 2: 微信小程序项目框架

**Files:**
- Create: `tiangong-assistant/miniprogram/app.js`
- Create: `tiangong-assistant/miniprogram/app.json`
- Create: `tiangong-assistant/miniprogram/app.wxss`
- Create: `tiangong-assistant/miniprogram/sitemap.json`
- Create: `tiangong-assistant/miniprogram/utils/api.js`
- Create: `tiangong-assistant/miniprogram/utils/storage.js`
- Create: `tiangong-assistant/miniprogram/utils/format.js`

- [ ] **Step 1: 创建小程序 app.js**

```js
// miniprogram/app.js
App({
  onLaunch() {
    // 检查是否有 openid
    wx.cloud.init({
      env: 'your-env-id',  // 替换为实际云开发环境 ID
      traceUser: true
    });
  },

  globalData: {
    userInfo: null,
    syncStatus: null
  }
});
```

- [ ] **Step 2: 创建 app.json（页面路由 + TabBar）**

```json
{
  "pages": [
    "pages/index/index",
    "pages/chat/chat",
    "pages/notes/notes",
    "pages/note-detail/note-detail",
    "pages/sync/sync",
    "pages/settings/settings"
  ],
  "tabBar": {
    "color": "#999999",
    "selectedColor": "#07c160",
    "backgroundColor": "#ffffff",
    "borderStyle": "black",
    "list": [
      {
        "pagePath": "pages/index/index",
        "text": "问答",
        "iconPath": "images/tab-chat.png",
        "selectedIconPath": "images/tab-chat-active.png"
      },
      {
        "pagePath": "pages/notes/notes",
        "text": "笔记",
        "iconPath": "images/tab-notes.png",
        "selectedIconPath": "images/tab-notes-active.png"
      },
      {
        "pagePath": "pages/sync/sync",
        "text": "同步",
        "iconPath": "images/tab-sync.png",
        "selectedIconPath": "images/tab-sync-active.png"
      },
      {
        "pagePath": "pages/settings/settings",
        "text": "设置",
        "iconPath": "images/tab-settings.png",
        "selectedIconPath": "images/tab-settings-active.png"
      }
    ]
  },
  "window": {
    "backgroundTextStyle": "light",
    "navigationBarBackgroundColor": "#ffffff",
    "navigationBarTitleText": "天工助手",
    "navigationBarTextStyle": "black",
    "backgroundColor": "#f5f5f5"
  },
  "sitemapLocation": "sitemap.json"
}
```

- [ ] **Step 3: 创建全局样式 app.wxss**

```css
/* miniprogram/app.wxss */
page {
  background-color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: #333;
}

.container {
  padding: 16px;
}

.card {
  background: #ffffff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.btn-primary {
  background: #07c160;
  color: #fff;
  border-radius: 8px;
  padding: 10px 20px;
  text-align: center;
  font-size: 15px;
  border: none;
}

.btn-primary:active {
  background: #06ad56;
}

.btn-danger {
  background: #fa5151;
  color: #fff;
  border-radius: 8px;
  padding: 10px 20px;
  text-align: center;
  font-size: 15px;
  border: none;
}

.text-secondary {
  color: #999;
  font-size: 12px;
}

.loading {
  text-align: center;
  padding: 20px;
  color: #999;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}
```

- [ ] **Step 4: 创建 sitemap.json**

```json
{
  "desc": "关于本文件的更多信息，请参考文档 https://developers.weixin.qq.com/miniprogram/dev/framework/sitemap.html",
  "rules": [{
    "action": "allow",
    "page": "*"
  }]
}
```

- [ ] **Step 5: 创建 utils/api.js（云函数调用封装）**

```js
// miniprogram/utils/api.js
function callCloudFunction(name, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: res => {
        if (res.result && res.result.code === 0) {
          resolve(res.result.data);
        } else {
          reject(new Error(res.result?.message || '请求失败'));
        }
      },
      fail: err => {
        reject(err);
      }
    });
  });
}

module.exports = {
  // 获取笔记本列表
  getNotebooks() {
    return callCloudFunction('getNotebooks');
  },

  // 获取分区下的页面列表
  getPages(sectionId, notebookId) {
    return callCloudFunction('getPages', { sectionId, notebookId });
  },

  // 获取页面详情
  getPageDetail(pageId) {
    return callCloudFunction('getPageDetail', { pageId });
  },

  // 触发同步
  syncNotes() {
    return callCloudFunction('syncNotes');
  },

  // 获取同步日志
  getSyncLogs(limit = 20) {
    return callCloudFunction('getSyncLogs', { limit });
  },

  // 发起问答
  askQuestion(question, conversationId = null) {
    return callCloudFunction('askQuestion', { question, conversationId });
  },

  // 开始 OneNote 授权
  authDeviceCode() {
    return callCloudFunction('authDeviceCode');
  },

  // 清空知识库
  clearKnowledgeBase() {
    return callCloudFunction('clearKnowledgeBase');
  }
};
```

> 注意：云函数返回格式统一为 `{ code: 0, data: ..., message: '...' }`

- [ ] **Step 6: 创建 utils/storage.js**

```js
// miniprogram/utils/storage.js
const KEYS = {
  CONVERSATIONS: 'conversations',   // 对话历史
  LAST_SYNC: 'lastSync',            // 最后同步时间
  AUTH_STATUS: 'authStatus'         // 授权状态
};

module.exports = {
  // 保存对话历史
  saveConversation(conversation) {
    const list = this.getConversations();
    const idx = list.findIndex(c => c.id === conversation.id);
    if (idx >= 0) {
      list[idx] = conversation;
    } else {
      list.unshift(conversation);
    }
    // 最多保留 20 个对话
    if (list.length > 20) list.pop();
    wx.setStorageSync(KEYS.CONVERSATIONS, list);
  },

  getConversations() {
    return wx.getStorageSync(KEYS.CONVERSATIONS) || [];
  },

  getConversation(id) {
    const list = this.getConversations();
    return list.find(c => c.id === id) || null;
  },

  saveLastSync(time) {
    wx.setStorageSync(KEYS.LAST_SYNC, time);
  },

  getLastSync() {
    return wx.getStorageSync(KEYS.LAST_SYNC) || null;
  },

  saveAuthStatus(status) {
    wx.setStorageSync(KEYS.AUTH_STATUS, status);
  },

  getAuthStatus() {
    return wx.getStorageSync(KEYS.AUTH_STATUS) || { connected: false };
  }
};
```

- [ ] **Step 7: 创建 utils/format.js**

```js
// miniprogram/utils/format.js
function formatDate(dateStr) {
  if (!dateStr) return '未知';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function truncate(str, len = 60) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

module.exports = { formatDate, formatTime, truncate, generateId };
```

- [ ] **Step 8: 占位图片资源**

在 `tiangong-assistant/miniprogram/images/` 中放置 8 张 TabBar 图标（可用纯色占位图）。

```bash
mkdir -p /home/mac/tiangong-assistant/miniprogram/images
```

- [ ] **Step 9: 提交**

```bash
cd /home/mac/tiangong-assistant
git add miniprogram/app.js miniprogram/app.json miniprogram/app.wxss miniprogram/sitemap.json miniprogram/utils/
git commit -m "feat: init miniprogram project structure with utils"
```

---

## Task 3: 首页（问答入口）

**Files:**
- Create: `tiangong-assistant/miniprogram/pages/index/index.js`
- Create: `tiangong-assistant/miniprogram/pages/index/index.json`
- Create: `tiangong-assistant/miniprogram/pages/index/index.wxml`
- Create: `tiangong-assistant/miniprogram/pages/index/index.wxss`

- [ ] **Step 1: 创建 index.json**

```json
{
  "navigationBarTitleText": "天工助手",
  "usingComponents": {}
}
```

- [ ] **Step 2: 创建 index.wxml**

```html
<!-- miniprogram/pages/index/index.wxml -->
<view class="container">
  <!-- 搜索栏 -->
  <view class="search-bar">
    <input
      class="search-input"
      placeholder="搜索笔记 或 直接提问..."
      value="{{question}}"
      bindinput="onInput"
      bindconfirm="onSearch"
      confirm-type="search"
    />
    <view class="search-btn" bindtap="onSearch">提问</view>
  </view>

  <!-- 知识库状态 -->
  <view class="card status-card">
    <view class="status-row">
      <text class="status-label">📚 知识库</text>
      <text class="status-value">{{stats.totalChunks || 0}} 个片段</text>
    </view>
    <view class="status-row">
      <text class="status-label">⏰ 最后同步</text>
      <text class="status-value">{{lastSyncText}}</text>
    </view>
    <view class="status-row" wx:if="{{authConnected}}">
      <text class="status-label">🔗 OneNote</text>
      <text class="status-value" style="color: #07c160;">已连接</text>
    </view>
    <view class="status-row" wx:if="{{!authConnected}}">
      <text class="status-label">🔗 OneNote</text>
      <text class="status-value" style="color: #fa5151;">未连接</text>
    </view>
  </view>

  <!-- 最近提问 -->
  <view class="card" wx:if="{{recentQuestions.length > 0}}">
    <view class="card-title">💡 最近提问</view>
    <view
      class="recent-item"
      wx:for="{{recentQuestions}}"
      bindtap="onRecentTap"
      data-index="{{index}}"
    >
      <text class="recent-text">{{item.question}}</text>
      <text class="recent-date">{{item.date}}</text>
    </view>
  </view>

  <!-- 空状态 -->
  <view class="empty-state" wx:if="{{recentQuestions.length === 0}}">
    <text>👋 欢迎使用天工助手</text>
    <text class="empty-hint">连接 OneNote 后，即可用自然语言提问</text>
  </view>
</view>
```

- [ ] **Step 3: 创建 index.wxss**

```css
/* miniprogram/pages/index/index.wxss */
.search-bar {
  display: flex;
  background: #fff;
  border-radius: 12px;
  padding: 8px 12px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.search-input {
  flex: 1;
  padding: 8px;
  font-size: 15px;
}

.search-btn {
  background: #07c160;
  color: #fff;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  display: flex;
  align-items: center;
}

.status-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid #f0f0f0;
}

.status-row:last-child {
  border-bottom: none;
}

.status-label {
  font-size: 14px;
  color: #666;
}

.status-value {
  font-size: 14px;
  color: #333;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
}

.recent-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
}

.recent-item:last-child {
  border-bottom: none;
}

.recent-text {
  flex: 1;
  font-size: 14px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-date {
  font-size: 12px;
  color: #999;
  margin-left: 12px;
}

.empty-hint {
  display: block;
  font-size: 12px;
  margin-top: 8px;
}
```

- [ ] **Step 4: 创建 index.js**

```js
// miniprogram/pages/index/index.js
const api = require('../../utils/api');
const storage = require('../../utils/storage');
const { formatDate, generateId } = require('../../utils/format');

Page({
  data: {
    question: '',
    stats: { totalChunks: 0 },
    lastSyncText: '从未同步',
    authConnected: false,
    recentQuestions: []
  },

  onLoad() {
    this.loadStatus();
    this.loadRecentQuestions();
  },

  onShow() {
    this.loadStatus();
  },

  async loadStatus() {
    const authStatus = storage.getAuthStatus();
    const lastSync = storage.getLastSync();
    this.setData({
      authConnected: authStatus.connected,
      lastSyncText: lastSync ? formatDate(lastSync) : '从未同步'
    });

    // 从云函数获取统计
    try {
      const data = await api.getSyncLogs(1);
      if (data && data.totalChunks !== undefined) {
        this.setData({ stats: { totalChunks: data.totalChunks } });
      }
    } catch (e) {
      // 忽略
    }
  },

  loadRecentQuestions() {
    const convs = storage.getConversations();
    const recent = convs.slice(0, 5).map(c => ({
      id: c.id,
      question: c.messages[0]?.content || '',
      date: formatDate(c.updatedAt)
    }));
    this.setData({ recentQuestions: recent });
  },

  onInput(e) {
    this.setData({ question: e.detail.value });
  },

  onSearch() {
    const q = this.data.question.trim();
    if (!q) {
      wx.showToast({ title: '请输入问题', icon: 'none' });
      return;
    }
    const convId = generateId();
    // 保存初始对话
    storage.saveConversation({
      id: convId,
      messages: [{ role: 'user', content: q, time: new Date().toISOString() }],
      sources: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    wx.navigateTo({ url: `/pages/chat/chat?id=${convId}` });
    this.setData({ question: '' });
  },

  onRecentTap(e) {
    const idx = e.currentTarget.dataset.index;
    const conv = this.data.recentQuestions[idx];
    wx.navigateTo({ url: `/pages/chat/chat?id=${conv.id}` });
  }
});
```

- [ ] **Step 5: 提交**

```bash
cd /home/mac/tiangong-assistant
git add miniprogram/pages/index/
git commit -m "feat: add index page with search bar and status card"
```

---

## Task 4: 对话页

**Files:**
- Create: `tiangong-assistant/miniprogram/pages/chat/chat.js`
- Create: `tiangong-assistant/miniprogram/pages/chat/chat.json`
- Create: `tiangong-assistant/miniprogram/pages/chat/chat.wxml`
- Create: `tiangong-assistant/miniprogram/pages/chat/chat.wxss`

- [ ] **Step 1: 创建 chat.json**

```json
{
  "navigationBarTitleText": "对话",
  "usingComponents": {}
}
```

- [ ] **Step 2: 创建 chat.wxml**

```html
<!-- miniprogram/pages/chat/chat.wxml -->
<scroll-view
  class="chat-scroll"
  scroll-y
  scroll-into-view="{{scrollToId}}"
  scroll-with-animation
>
  <view class="chat-container">
    <!-- 消息列表 -->
    <block wx:for="{{messages}}" wx:key="index">
      <!-- 用户消息 -->
      <view class="msg-row msg-right" wx:if="{{item.role === 'user'}}">
        <view class="bubble bubble-user">
          <text>{{item.content}}</text>
        </view>
      </view>

      <!-- AI 消息 -->
      <view class="msg-row msg-left" wx:if="{{item.role === 'assistant'}}">
        <view class="bubble bubble-ai">
          <text wx:if="{{item.content}}">{{item.content}}</text>
          <view wx:else class="typing-indicator">
            <view class="dot"></view>
            <view class="dot"></view>
            <view class="dot"></view>
          </view>
        </view>
        <!-- 来源引用 -->
        <block wx:if="{{item.sources && item.sources.length > 0}}">
          <view class="sources">
            <text class="sources-title">📄 来源：</text>
            <view
              class="source-item"
              wx:for="{{item.sources}}"
              wx:for-item="src"
              bindtap="onSourceTap"
              data-url="{{src.page_url}}"
            >
              <text>《{{src.notebook}}》/ {{src.section}} / {{src.page_title}}</text>
            </view>
          </view>
        </block>
        <!-- 反馈 -->
        <view class="feedback" wx:if="{{item.feedback !== undefined}}">
          <text class="feedback-text">{{item.feedback === 1 ? '👍' : item.feedback === -1 ? '👎' : ''}}</text>
        </view>
        <view class="feedback" wx:if="{{item.feedback === undefined && item.content}}">
          <text class="feedback-btn" bindtap="onFeedback" data-index="{{index}}" data-value="1">👍</text>
          <text class="feedback-btn" bindtap="onFeedback" data-index="{{index}}" data-value="-1">👎</text>
        </view>
      </view>
    </block>
  </view>
</scroll-view>

<!-- 底部输入栏 -->
<view class="input-bar">
  <input
    class="msg-input"
    placeholder="输入消息..."
    value="{{inputText}}"
    bindinput="onInputChange"
    bindconfirm="onSend"
    confirm-type="send"
    disabled="{{loading}}"
  />
  <view class="send-btn {{inputText.trim() ? 'active' : ''}}" bindtap="onSend">
    <text>发送</text>
  </view>
</view>
```

- [ ] **Step 3: 创建 chat.wxss**

```css
/* miniprogram/pages/chat/chat.wxss */
.chat-scroll {
  height: calc(100vh - 56px);
  padding-bottom: 16px;
}

.chat-container {
  padding: 16px;
}

.msg-row {
  display: flex;
  margin-bottom: 16px;
}

.msg-right {
  justify-content: flex-end;
}

.msg-left {
  justify-content: flex-start;
}

.bubble {
  max-width: 75%;
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 15px;
  line-height: 1.6;
  word-break: break-word;
}

.bubble-user {
  background: #07c160;
  color: #fff;
  border-bottom-right-radius: 4px;
}

.bubble-ai {
  background: #fff;
  color: #333;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.sources {
  margin-top: 8px;
  padding: 8px 12px;
  background: #f9f9f9;
  border-radius: 8px;
}

.sources-title {
  font-size: 12px;
  color: #999;
}

.source-item {
  font-size: 12px;
  color: #576b95;
  padding: 4px 0;
}

.source-item:active {
  opacity: 0.7;
}

.feedback {
  margin-top: 6px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.feedback-btn {
  font-size: 16px;
  padding: 2px 6px;
}

.feedback-text {
  font-size: 16px;
}

/* 打字动画 */
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.dot {
  width: 6px;
  height: 6px;
  background: #999;
  border-radius: 50%;
  animation: bounce 1.2s infinite;
}

.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

/* 底部输入 */
.input-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  border-top: 1px solid #e5e5e5;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.msg-input {
  flex: 1;
  background: #f5f5f5;
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 14px;
}

.send-btn {
  background: #ccc;
  color: #fff;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
}

.send-btn.active {
  background: #07c160;
}
```

- [ ] **Step 4: 创建 chat.js**

```js
// miniprogram/pages/chat/chat.js
const api = require('../../utils/api');
const storage = require('../../utils/storage');
const { generateId } = require('../../utils/format');

Page({
  data: {
    messages: [],
    inputText: '',
    loading: false,
    scrollToId: '',
    conversationId: null
  },

  onLoad(options) {
    const convId = options.id;
    this.data.conversationId = convId;

    const conv = storage.getConversation(convId);
    if (conv && conv.messages.length > 0) {
      // 已有对话，加载历史
      this.setData({ messages: conv.messages });
      if (conv.messages.length === 1 && conv.messages[0].role === 'user') {
        // 只有用户消息，自动发起问答
        this.doAsk(conv.messages[0].content);
      }
    }
  },

  onInputChange(e) {
    this.setData({ inputText: e.detail.value });
  },

  onSend() {
    const text = this.data.inputText.trim();
    if (!text || this.data.loading) return;

    const userMsg = {
      role: 'user',
      content: text,
      time: new Date().toISOString()
    };

    const messages = [...this.data.messages, userMsg];
    this.setData({
      messages,
      inputText: '',
      loading: true
    });

    // 保存到本地
    this.saveMessages(messages);
    this.doAsk(text);
  },

  async doAsk(question) {
    // 添加 loading 占位
    const loadingMsg = { role: 'assistant', content: '', time: new Date().toISOString() };
    const messages = [...this.data.messages, loadingMsg];
    this.setData({ messages });

    try {
      const result = await api.askQuestion(question, this.data.conversationId);

      // 替换 loading 消息
      const aiMsg = {
        role: 'assistant',
        content: result.answer || '抱歉，我没有找到相关信息。',
        sources: result.sources || [],
        time: new Date().toISOString()
      };

      const finalMessages = [...this.data.messages, aiMsg];
      this.setData({
        messages: finalMessages,
        loading: false,
        scrollToId: `msg-${finalMessages.length - 1}`
      });

      this.saveMessages(finalMessages);
    } catch (e) {
      const errorMsg = {
        role: 'assistant',
        content: '请求失败，请稍后重试。',
        time: new Date().toISOString()
      };
      const finalMessages = [...this.data.messages, errorMsg];
      this.setData({ messages: finalMessages, loading: false });
      this.saveMessages(finalMessages);
    }
  },

  saveMessages(messages) {
    const conv = storage.getConversation(this.data.conversationId) || {
      id: this.data.conversationId,
      messages: [],
      createdAt: new Date().toISOString()
    };
    conv.messages = messages;
    conv.updatedAt = new Date().toISOString();
    storage.saveConversation(conv);
  },

  onFeedback(e) {
    const idx = e.currentTarget.dataset.index;
    const value = e.currentTarget.dataset.value;
    const key = `messages[${idx}].feedback`;
    this.setData({ [key]: value });
  },

  onSourceTap(e) {
    const url = e.currentTarget.dataset.url;
    if (url) {
      // 复制链接到剪贴板
      wx.setClipboardData({
        data: url,
        success() {
          wx.showToast({ title: '链接已复制', icon: 'success' });
        }
      });
    }
  }
});
```

- [ ] **Step 5: 提交**

```bash
cd /home/mac/tiangong-assistant
git add miniprogram/pages/chat/
git commit -m "feat: add chat page with RAG Q&A UI"
```

---

## Task 5: 笔记浏览页 + 笔记详情页

**Files:**
- Create: `tiangong-assistant/miniprogram/pages/notes/notes.js`
- Create: `tiangong-assistant/miniprogram/pages/notes/notes.json`
- Create: `tiangong-assistant/miniprogram/pages/notes/notes.wxml`
- Create: `tiangong-assistant/miniprogram/pages/notes/notes.wxss`
- Create: `tiangong-assistant/miniprogram/pages/note-detail/note-detail.js`
- Create: `tiangong-assistant/miniprogram/pages/note-detail/note-detail.json`
- Create: `tiangong-assistant/miniprogram/pages/note-detail/note-detail.wxml`
- Create: `tiangong-assistant/miniprogram/pages/note-detail/note-detail.wxss`

- [ ] **Step 1: 创建笔记浏览页 notes.json**

```json
{
  "navigationBarTitleText": "笔记",
  "usingComponents": {}
}
```

- [ ] **Step 2: 创建 notes.wxml**

```html
<!-- miniprogram/pages/notes/notes.wxml -->
<view class="container">
  <!-- 加载状态 -->
  <view class="loading" wx:if="{{loading}}">加载中...</view>

  <!-- 笔记本列表 -->
  <view wx:else>
    <view wx:if="{{notebooks.length === 0}}" class="empty-state">
      <text>📭 暂无笔记</text>
      <text class="empty-hint">连接 OneNote 后同步笔记</text>
    </view>

    <block wx:for="{{notebooks}}" wx:key="id">
      <view class="card notebook-card">
        <!-- 笔记本标题 -->
        <view class="notebook-header" bindtap="toggleNotebook" data-index="{{index}}">
          <text class="notebook-icon">📓</text>
          <text class="notebook-name">{{item.name}}</text>
          <text class="notebook-count">{{item.pageCount}} 篇</text>
          <text class="expand-icon">{{item.expanded ? '▼' : '▶'}}</text>
        </view>

        <!-- 分区列表 -->
        <view class="sections" wx:if="{{item.expanded}}">
          <block wx:for="{{item.sections}}" wx:for-item="section" wx:key="id">
            <view class="section-item" bindtap="onSectionTap" data-section="{{section}}" data-notebook="{{item}}">
              <text class="section-icon">📂</text>
              <text class="section-name">{{section.name}}</text>
              <text class="section-count">{{section.pageCount}} 篇</text>
            </view>
          </block>
          <view wx:if="{{item.sections.length === 0}}" class="empty-hint" style="padding: 8px 0;">
            正在加载分区...
          </view>
        </view>
      </view>
    </block>
  </view>
</view>
```

- [ ] **Step 3: 创建 notes.wxss**

```css
/* miniprogram/pages/notes/notes.wxss */
.notebook-card {
  padding: 0;
  overflow: hidden;
}

.notebook-header {
  display: flex;
  align-items: center;
  padding: 16px;
  gap: 8px;
}

.notebook-header:active {
  background: #f9f9f9;
}

.notebook-icon {
  font-size: 20px;
}

.notebook-name {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
}

.notebook-count {
  font-size: 12px;
  color: #999;
}

.expand-icon {
  font-size: 12px;
  color: #999;
}

.sections {
  border-top: 1px solid #f0f0f0;
}

.section-item {
  display: flex;
  align-items: center;
  padding: 12px 16px 12px 44px;
  gap: 8px;
  border-bottom: 1px solid #f5f5f5;
}

.section-item:last-child {
  border-bottom: none;
}

.section-item:active {
  background: #f9f9f9;
}

.section-icon {
  font-size: 16px;
}

.section-name {
  flex: 1;
  font-size: 14px;
}

.section-count {
  font-size: 12px;
  color: #999;
}
```

- [ ] **Step 4: 创建 notes.js**

```js
// miniprogram/pages/notes/notes.js
const api = require('../../utils/api');

Page({
  data: {
    loading: true,
    notebooks: []
  },

  onLoad() {
    this.loadNotebooks();
  },

  onShow() {
    this.loadNotebooks();
  },

  async loadNotebooks() {
    this.setData({ loading: true });
    try {
      const data = await api.getNotebooks();
      const notebooks = (data.notebooks || []).map(nb => ({
        ...nb,
        expanded: false,
        sections: []
      }));
      this.setData({ notebooks, loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async toggleNotebook(e) {
    const idx = e.currentTarget.dataset.index;
    const notebooks = [...this.data.notebooks];
    notebooks[idx].expanded = !notebooks[idx].expanded;

    // 首次展开时加载分区
    if (notebooks[idx].expanded && notebooks[idx].sections.length === 0) {
      try {
        const sectionData = await api.getPages(null, notebooks[idx].id);
        notebooks[idx].sections = sectionData.sections || [];
      } catch (err) {
        notebooks[idx].sections = [];
      }
    }

    this.setData({ notebooks });
  },

  onSectionTap(e) {
    const section = e.currentTarget.dataset.section;
    const notebook = e.currentTarget.dataset.notebook;
    wx.navigateTo({
      url: `/pages/note-detail/note-detail?sectionId=${section.id}&notebookId=${notebook.id}&sectionName=${section.name}&notebookName=${notebook.name}`
    });
  }
});
```

- [ ] **Step 5: 创建笔记详情页 note-detail.json**

```json
{
  "navigationBarTitleText": "笔记详情",
  "usingComponents": {}
}
```

- [ ] **Step 6: 创建 note-detail.wxml**

```html
<!-- miniprogram/pages/note-detail/note-detail.wxml -->
<view class="container">
  <!-- 页面列表模式 -->
  <block wx:if="!{{pageDetailMode}}">
    <view class="section-header">
      <text class="section-path">《{{notebookName}}》/ {{sectionName}}</text>
    </view>

    <view class="loading" wx:if="{{loading}}">加载中...</view>

    <view wx:elif="{{pages.length === 0}}" class="empty-state">
      <text>该分区暂无页面</text>
    </view>

    <view wx:else>
      <view
        class="card page-item"
        wx:for="{{pages}}"
        bindtap="onPageTap"
        data-item="{{item}}"
      >
        <text class="page-title">{{item.title}}</text>
        <text class="page-date">{{item.modifiedDate}}</text>
      </view>
    </view>
  </block>

  <!-- 单页详情模式 -->
  <block wx:if="{{pageDetailMode}}">
    <view class="page-detail-header">
      <text class="page-detail-title">{{currentPage.title}}</text>
      <text class="page-detail-date">修改于 {{currentPage.modifiedDate}}</text>
    </view>

    <view class="card page-content">
      <text>{{currentPage.textContent}}</text>
    </view>

    <!-- 附件 -->
    <view class="card" wx:if="{{currentPage.attachments.length > 0}}">
      <view class="card-title">📎 附件</view>
      <view
        class="attachment-item"
        wx:for="{{currentPage.attachments}}"
        bindtap="onAttachmentTap"
        data-url="{{item.url}}"
      >
        <text>{{item.name}}</text>
        <text class="attachment-link">查看 →</text>
      </view>
    </view>

    <!-- 在 OneNote 中打开 -->
    <view class="card">
      <view class="btn-primary" bindtap="openInOneNote">
        🔗 在 OneNote 中打开
      </view>
    </view>
  </block>
</view>
```

- [ ] **Step 7: 创建 note-detail.wxss**

```css
/* miniprogram/pages/note-detail/note-detail.wxss */
.section-header {
  padding: 12px 0;
}

.section-path {
  font-size: 13px;
  color: #999;
}

.page-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-item:active {
  background: #f9f9f9;
}

.page-title {
  flex: 1;
  font-size: 15px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-date {
  font-size: 12px;
  color: #999;
  margin-left: 12px;
}

.page-detail-header {
  margin-bottom: 16px;
}

.page-detail-title {
  font-size: 20px;
  font-weight: 600;
  display: block;
}

.page-detail-date {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
  display: block;
}

.page-content {
  font-size: 15px;
  line-height: 1.8;
  white-space: pre-wrap;
}

.attachment-item {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
}

.attachment-item:last-child {
  border-bottom: none;
}

.attachment-link {
  color: #576b95;
  font-size: 13px;
}
```

- [ ] **Step 8: 创建 note-detail.js**

```js
// miniprogram/pages/note-detail/note-detail.js
const api = require('../../utils/api');
const { formatDate } = require('../../utils/format');

Page({
  data: {
    loading: true,
    pageDetailMode: false,
    sectionId: '',
    notebookId: '',
    sectionName: '',
    notebookName: '',
    pages: [],
    currentPage: null
  },

  onLoad(options) {
    this.setData({
      sectionId: options.sectionId,
      notebookId: options.notebookId,
      sectionName: options.sectionName,
      notebookName: options.notebookName
    });
    this.loadPages();
  },

  async loadPages() {
    this.setData({ loading: true });
    try {
      const data = await api.getPages(this.data.sectionId, this.data.notebookId);
      const pages = (data.pages || []).map(p => ({
        ...p,
        modifiedDate: formatDate(p.lastModifiedDateTime)
      }));
      this.setData({ pages, loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async onPageTap(e) {
    const item = e.currentTarget.dataset.item;
    try {
      const data = await api.getPageDetail(item.id);
      this.setData({
        pageDetailMode: true,
        currentPage: {
          title: data.title || item.title,
          textContent: data.textContent || '（无文本内容）',
          attachments: data.attachments || [],
          modifiedDate: formatDate(data.lastModifiedDateTime || item.lastModifiedDateTime),
          oneNoteUrl: data.oneNoteUrl || ''
        }
      });
      wx.setNavigationBarTitle({ title: data.title || item.title });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onAttachmentTap(e) {
    const url = e.currentTarget.dataset.url;
    wx.setClipboardData({
      data: url,
      success() {
        wx.showToast({ title: '链接已复制', icon: 'success' });
      }
    });
  },

  openInOneNote() {
    const url = this.data.currentPage?.oneNoteUrl;
    if (url) {
      wx.setClipboardData({
        data: url,
        success() {
          wx.showToast({ title: 'OneNote 链接已复制', icon: 'success' });
        }
      });
    } else {
      wx.showToast({ title: '无法打开', icon: 'none' });
    }
  }
});
```

- [ ] **Step 9: 提交**

```bash
cd /home/mac/tiangong-assistant
git add miniprogram/pages/notes/ miniprogram/pages/note-detail/
git commit -m "feat: add notes browsing and note detail pages"
```

---

## Task 6: 同步管理页

**Files:**
- Create: `tiangong-assistant/miniprogram/pages/sync/sync.js`
- Create: `tiangong-assistant/miniprogram/pages/sync/sync.json`
- Create: `tiangong-assistant/miniprogram/pages/sync/sync.wxml`
- Create: `tiangong-assistant/miniprogram/pages/sync/sync.wxss`

- [ ] **Step 1: 创建 sync.json**

```json
{
  "navigationBarTitleText": "同步管理",
  "usingComponents": {}
}
```

- [ ] **Step 2: 创建 sync.wxml**

```html
<!-- miniprogram/pages/sync/sync.wxml -->
<view class="container">
  <!-- 同步操作 -->
  <view class="card">
    <view class="sync-header">
      <text class="sync-title">OneNote 同步</text>
      <text wx:if="{{syncing}}" class="sync-status">同步中...</text>
    </view>
    <view class="btn-primary {{syncing ? 'disabled' : ''}}" bindtap="onSyncTap">
      {{syncing ? '同步中...' : '🔄 立即同步'}}
    </view>
    <text class="sync-hint" wx:if="{{lastSyncTime}}">
      上次同步：{{lastSyncTime}}
    </text>
  </view>

  <!-- 笔记本同步开关 -->
  <view class="card" wx:if="{{notebooks.length > 0}}">
    <view class="card-title">📚 同步范围</view>
    <view
      class="toggle-item"
      wx:for="{{notebooks}}"
      bindtap="toggleNotebook"
      data-index="{{index}}"
    >
      <text class="toggle-name">{{item.name}} ({{item.pageCount}}篇)</text>
      <text class="toggle-switch {{item.syncEnabled ? 'on' : 'off'}}">
        {{item.syncEnabled ? '✓' : '✗'}}
      </text>
    </view>
  </view>

  <!-- 同步日志 -->
  <view class="card">
    <view class="card-title">📋 同步日志</view>
    <view wx:if="{{logs.length === 0}}" class="empty-hint">暂无同步记录</view>
    <view class="log-item" wx:for="{{logs}}">
      <view class="log-header">
        <text class="log-status {{item.status === 'success' ? 'success' : 'error'}}">
          {{item.status === 'success' ? '✅' : '❌'}}
        </text>
        <text class="log-time">{{item.time}}</text>
      </view>
      <text class="log-detail">
        新增 {{item.added || 0}} 篇，更新 {{item.updated || 0}} 篇
        <text wx:if="{{item.duration}}">，耗时 {{item.duration}}s</text>
      </text>
      <text class="log-error" wx:if="{{item.error}}">{{item.error}}</text>
    </view>
  </view>
</view>
```

- [ ] **Step 3: 创建 sync.wxss**

```css
/* miniprogram/pages/sync/sync.wxss */
.sync-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.sync-title {
  font-size: 16px;
  font-weight: 600;
}

.sync-status {
  font-size: 13px;
  color: #07c160;
}

.sync-hint {
  display: block;
  text-align: center;
  font-size: 12px;
  color: #999;
  margin-top: 8px;
}

.toggle-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.toggle-item:last-child {
  border-bottom: none;
}

.toggle-name {
  font-size: 14px;
}

.toggle-switch {
  font-size: 16px;
  padding: 2px 8px;
  border-radius: 4px;
}

.toggle-switch.on {
  color: #07c160;
}

.toggle-switch.off {
  color: #999;
}

.log-item {
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.log-item:last-child {
  border-bottom: none;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.log-status {
  font-size: 14px;
}

.log-time {
  font-size: 13px;
  color: #666;
}

.log-detail {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
  display: block;
}

.log-error {
  font-size: 12px;
  color: #fa5151;
  margin-top: 4px;
  display: block;
}
```

- [ ] **Step 4: 创建 sync.js**

```js
// miniprogram/pages/sync/sync.js
const api = require('../../utils/api');
const storage = require('../../utils/storage');
const { formatDate, formatTime } = require('../../utils/format');

Page({
  data: {
    syncing: false,
    lastSyncTime: '',
    notebooks: [],
    logs: []
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    const lastSync = storage.getLastSync();
    this.setData({
      lastSyncTime: lastSync ? `${formatDate(lastSync)} ${formatTime(lastSync)}` : ''
    });

    // 加载同步日志
    try {
      const data = await api.getSyncLogs(20);
      const logs = (data.logs || []).map(l => ({
        ...l,
        time: l.syncTime ? `${formatDate(l.syncTime)} ${formatTime(l.syncTime)}` : ''
      }));
      this.setData({ logs });
    } catch (e) {
      // 忽略
    }

    // 加载笔记本列表（用于同步范围设置）
    try {
      const nbData = await api.getNotebooks();
      const notebooks = (nbData.notebooks || []).map(nb => ({
        ...nb,
        syncEnabled: true
      }));
      this.setData({ notebooks });
    } catch (e) {
      // 忽略
    }
  },

  async onSyncTap() {
    if (this.data.syncing) return;
    this.setData({ syncing: true });

    try {
      const result = await api.syncNotes();
      storage.saveLastSync(new Date().toISOString());
      wx.showToast({ title: '同步完成', icon: 'success' });
      this.loadData();
    } catch (e) {
      wx.showToast({ title: e.message || '同步失败', icon: 'none' });
    } finally {
      this.setData({ syncing: false });
    }
  },

  toggleNotebook(e) {
    const idx = e.currentTarget.dataset.index;
    const key = `notebooks[${idx}].syncEnabled`;
    this.setData({ [key]: !this.data.notebooks[idx].syncEnabled });
  }
});
```

- [ ] **Step 5: 提交**

```bash
cd /home/mac/tiangong-assistant
git add miniprogram/pages/sync/
git commit -m "feat: add sync management page"
```

---

## Task 7: 设置页

**Files:**
- Create: `tiangong-assistant/miniprogram/pages/settings/settings.js`
- Create: `tiangong-assistant/miniprogram/pages/settings/settings.json`
- Create: `tiangong-assistant/miniprogram/pages/settings/settings.wxml`
- Create: `tiangong-assistant/miniprogram/pages/settings/settings.wxss`

- [ ] **Step 1: 创建 settings.json**

```json
{
  "navigationBarTitleText": "设置",
  "usingComponents": {}
}
```

- [ ] **Step 2: 创建 settings.wxml**

```html
<!-- miniprogram/pages/settings/settings.wxss -->
<view class="container">
  <!-- OneNote 授权 -->
  <view class="card">
    <view class="setting-item" bindtap="onAuthTap">
      <text class="setting-label">🔗 OneNote 授权</text>
      <text class="setting-value {{authConnected ? 'connected' : 'disconnected'}}">
        {{authConnected ? '已连接 ✓' : '未连接'}}
      </text>
    </view>
  </view>

  <!-- 同步频率 -->
  <view class="card">
    <view class="setting-item">
      <text class="setting-label">⏰ 自动同步</text>
      <text class="setting-value">每天 03:00</text>
    </view>
  </view>

  <!-- 清空知识库 -->
  <view class="card">
    <view class="setting-item" bindtap="onClearTap">
      <text class="setting-label danger">🗑 清空知识库</text>
      <text class="setting-arrow">›</text>
    </view>
  </view>

  <!-- 关于 -->
  <view class="card">
    <view class="setting-item" bindtap="onAboutTap">
      <text class="setting-label">ℹ 关于</text>
      <text class="setting-arrow">›</text>
    </view>
  </view>

  <text class="version-text">天工助手 v1.0.0</text>
</view>
```

- [ ] **Step 3: 创建 settings.wxss**

```css
/* miniprogram/pages/settings/settings.wxss */
.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.setting-label {
  font-size: 15px;
  color: #333;
}

.setting-label.danger {
  color: #fa5151;
}

.setting-value {
  font-size: 14px;
  color: #999;
}

.setting-value.connected {
  color: #07c160;
}

.setting-value.disconnected {
  color: #fa5151;
}

.setting-arrow {
  font-size: 18px;
  color: #ccc;
}

.version-text {
  display: block;
  text-align: center;
  font-size: 12px;
  color: #ccc;
  margin-top: 40px;
}
```

- [ ] **Step 4: 创建 settings.js**

```js
// miniprogram/pages/settings/settings.js
const api = require('../../utils/api');
const storage = require('../../utils/storage');

Page({
  data: {
    authConnected: false
  },

  onLoad() {
    this.checkAuth();
  },

  onShow() {
    this.checkAuth();
  },

  checkAuth() {
    const status = storage.getAuthStatus();
    this.setData({ authConnected: status.connected });
  },

  async onAuthTap() {
    if (this.data.authConnected) {
      wx.showModal({
        title: '重新授权',
        content='确定要重新连接 OneNote 吗？',
        success: async (res) => {
          if (res.confirm) {
            await this.startAuth();
          }
        }
      });
    } else {
      await this.startAuth();
    }
  },

  async startAuth() {
    try {
      wx.showLoading({ title: '正在获取授权码...' });
      const data = await api.authDeviceCode();
      wx.hideLoading();

      // 显示设备码给用户
      wx.showModal({
        title: '请在浏览器中授权',
        content: `设备码：${data.userCode}\n\n请在浏览器打开：${data.verificationUrl}`,
        confirmText: '复制设备码',
        success: (res) => {
          if (res.confirm) {
            wx.setClipboardData({ data: data.userCode });
          }
        }
      });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '授权请求失败', icon: 'none' });
    }
  },

  onClearTap() {
    wx.showModal({
      title: '清空知识库',
      content: '确定要清空所有已同步的笔记数据吗？此操作不可恢复。',
      confirmText: '确认清空',
      confirmColor: '#fa5151',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.clearKnowledgeBase();
            storage.saveLastSync(null);
            wx.showToast({ title: '已清空', icon: 'success' });
          } catch (e) {
            wx.showToast({ title: '操作失败', icon: 'none' });
          }
        }
      }
    });
  },

  onAboutTap() {
    wx.showModal({
      title: '关于天工助手',
      content: '天工助手 v1.0.0\n\n将 OneNote 笔记构建为个人知识库，支持自然语言问答。\n\n技术栈：微信小程序 + 微信云开发 + Supabase + DeepSeek',
      showCancel: false
    });
  }
});
```

- [ ] **Step 5: 提交**

```bash
cd /home/mac/tiangong-assistant
git add miniprogram/pages/settings/
git commit -m "mfeat: add settings page"
```

---

## Task 8: 云函数 — OneNote 认证（authDeviceCode + authPollToken）

**Files:**
- Create: `tiangong-assistant/cloudfunctions/authDeviceCode/index.js`
- Create: `tiangong-assistant/cloudfunctions/authPollToken/index.js`

- [ ] **Step 1: 创建 authDeviceCode/index.js**

```js
// cloudfunctions/authDeviceCode/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 微软 OAuth2 设备码流
const MS_DEVICE_CODE_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/devicecode';
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

// 注意：需要在云函数环境变量中配置以下值
// 或通过 db 中的 config 集合读取
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || '';
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || 'common';

exports.main = async (event, context) => {
  const wxContext = cloud.getWXOpenId && await cloud.getWXOpenId();

  try {
    // 请求设备码
    const deviceCodeRes = await fetch(MS_DEVICE_CODE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: AZURE_CLIENT_ID,
        scope: 'https://graph.microsoft.com/Notes.Read offline_access'
      })
    });

    const deviceCodeData = await deviceCodeRes.json();

    if (deviceCodeData.error) {
      return { code: 500, message: deviceCodeData.error_description || '获取设备码失败' };
    }

    // 保存设备码信息到数据库，用于后续轮询
    await db.collection('auth_state').add({
      data: {
        deviceCode: deviceCodeData.device_code,
        userCode: deviceCodeData.user_code,
        verificationUrl: deviceCodeData.verification_uri,
        expiresAt: new Date(Date.now() + deviceCodeData.expires_in * 1000),
        pollInterval: deviceCodeData.interval || 5,
        status: 'pending',
        createdAt: new Date()
      }
    });

    return {
      code: 0,
      data: {
        userCode: deviceCodeData.user_code,
        verificationUrl: deviceCodeData.verification_uri,
        expiresIn: deviceCodeData.expires_in,
        message: deviceCodeData.message
      }
    };
  } catch (err) {
    console.error('authDeviceCode error:', err);
    return { code: 500, message: '授权服务异常' };
  }
};
```

- [ ] **Step 2: 创建 authPollToken/index.js**

```js
// cloudfunctions/authPollToken/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || '';

exports.main = async (event, context) => {
  try {
    // 查找待轮询的认证记录
    const authRecord = await db.collection('auth_state')
      .where({ status: 'pending' })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (authRecord.data.length === 0) {
      return { code: 0, data: { status: 'no_pending' } };
    }

    const record = authRecord.data[0];

    // 检查是否过期
    if (new Date() > record.expiresAt) {
      await db.collection('auth_state').doc(record._id).update({
        data: { status: 'expired' }
      });
      return { code: 0, data: { status: 'expired' } };
    }

    // 轮询 token
    const tokenRes = await fetch(MS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: AZURE_CLIENT_ID,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: record.deviceCode
      })
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error === 'authorization_pending') {
      return { code: 0, data: { status: 'pending' } };
    }

    if (tokenData.error === 'slow_down') {
      return { code: 0, data: { status: 'slow_down' } };
    }

    if (tokenData.access_token) {
      // 保存 token
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
      await db.collection('ms_graph_token').add({
        data: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt,
          createdAt: new Date()
        }
      });

      // 更新认证状态
      await db.collection('auth_state').doc(record._id).update({
        data: { status: 'authorized', authorizedAt: new Date() }
      });

      return { code: 0, data: { status: 'authorized' } };
    }

    return { code: 0, data: { status: 'error', error: tokenData.error } };
  } catch (err) {
    console.error('authPollToken error:', err);
    return { code: 500, message: '轮询异常' };
  }
};
```

- [ ] **Step 3: 提交**

```bash
cd /home/mac/tiangong-assistant
git add cloudfunctions/authDeviceCode/ cloudfunctions/authPollToken/
git commit -m "feat: add OneNote OAuth device code auth cloud functions"
```

---

## Task 9: 云函数 — 笔记同步（syncNotes）

**Files:**
- Create: `tiangong-assistant/cloudfunctions/syncNotes/index.js`

- [ ] **Step 1: 创建 syncNotes/index.js**

```js
// cloudfunctions/syncNotes/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const DEEPSEEK_EMBED_URL = 'https://api.deepseek.com/v1/embeddings';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

// ====== 工具函数 ======

async function getValidToken() {
  const record = await db.collection('ms_graph_token')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (record.data.length === 0) throw new Error('未授权 OneNote');

  const token = record.data[0];

  // 如果 token 即将过期（5 分钟内），尝试刷新
  if (new Date(token.expiresAt) < new Date(Date.now() + 5 * 60000)) {
    return await refreshToken(token.refreshToken);
  }

  return token.accessToken;
}

async function refreshToken(refreshToken) {
  const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  const res = await fetch(MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID || '',
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: 'https://graph.microsoft.com/Notes.Read offline_access'
    })
  });

  const data = await res.json();
  if (!data.access_token) throw new Error('Token 刷新失败');

  await db.collection('ms_graph_token').add({
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      createdAt: new Date()
    }
  });

  return data.access_token;
}

async function graphRequest(path, token) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Graph API ${res.status}: ${errText}`);
  }
  return res.json();
}

// HTML → 纯文本清洗
function htmlToText(html) {
  if (!html) return '';
  return html
    // 移除 script/style 及其内容
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // 标题前加标记
    .replace(/<h1[^>]*>/gi, '\n# ')
    .replace(/<h2[^>]*>/gi, '\n## ')
    .replace(/<h3[^>]*>/gi, '\n### ')
    .replace(/<\/h[1-6]>/gi, '\n')
    // 段落换行
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // 列表
    .replace(/<li[^>]*>/gi, '\n- ')
    // 附件链接
    .replace(/<a[^>]+href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, '$2: $1')
    // 移除所有剩余标签
    .replace(/<[^>]+>/g, '')
    // 实体解码
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    // 清理空白
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 文本分块
function splitIntoChunks(text, chunkSize = 500, overlap = 50) {
  if (!text || text.length <= chunkSize) return text ? [text] : [];

  const chunks = [];
  // 先按标题切分
  const sections = text.split(/^#{1,3}\s+/m).filter(s => s.trim());

  for (const section of sections) {
    if (section.length <= chunkSize) {
      if (section.trim().length >= 50) chunks.push(section.trim());
      continue;
    }
    // 长段再按字数切
    let start = 0;
    while (start < section.length) {
      const end = Math.min(start + chunkSize, section.length);
      const chunk = section.slice(start, end).trim();
      if (chunk.length >= 50) chunks.push(chunk);
      start += chunkSize - overlap;
    }
  }

  return chunks;
}

// DeepSeek embedding
async function getEmbedding(text) {
  const res = await fetch(DEEPSEEK_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text
    })
  });

  if (!res.ok) throw new Error(`Embedding failed: ${res.status}`);
  const data = await res.json();
  return data.data[0].embedding;
}

// Supabase 写入向量
async function upsertChunks(chunks, meta) {
  const rows = [];
  for (const chunk of chunks) {
    const embedding = await getEmbedding(chunk);
    rows.push({
      content: chunk,
      embedding,
      notebook: meta.notebook,
      section: meta.section,
      page_title: meta.pageTitle,
      page_id: meta.pageId,
      page_url: meta.pageUrl,
      modified_at: meta.modifiedAt
    });
  }

  // 先删除该页面的旧向量
  await fetch(`${SUPABASE_URL}/rest/v1/note_chunks?page_id=eq.${meta.pageId}`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });

  // 批量插入新向量
  const res = await fetch(`${SUPABASE_URL}/rest/v1/note_chunks`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(rows)
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Supabase insert error:', errText);
  }

  return rows.length;
}

// ====== 主函数 ======

exports.main = async (event, context) => {
  const startTime = Date.now();
  let added = 0, updated = 0, errors = 0;

  try {
    const token = await await getValidToken();

    // 1. 获取所有笔记本
    const notebooksData = await graphRequest('/me/onenote/notebooks', token);
    const notebooks = notebooksData.value || [];

    for (const notebook of notebooks) {
      // 2. 获取分区
      const sectionsData = await graphRequest(
        `/me/onenote/notebooks/${notebook.id}/sections`, token
      );
      const sections = sectionsData.value || [];

      for (const section of sections) {
        // 3. 获取页面列表
        const pagesData = await graphRequest(
          `/me/onenote/sections/${section.id}/pages?$select=id,title,lastModifiedDateTime,createdDateTime`, token
        );
        const pages = pagesData.value || [];

        for (const page of pages) {
          try {
            // 4. 获取页面内容
            const pageContent = await graphRequest(
              `/me/onenote/pages/${page.id}/content?includeIDs=true`, token
            );

            const textContent = htmlToText(pageContent.body?.content || '');

            if (!textContent || textContent.length < 20) continue;

            // 5. 分块
            const chunks = splitIntoChunks(textContent);

            if (chunks.length === 0) continue;

            // 6. 向量化并存入 Supabase
            const stored = await upsertChunks(chunks, {
              notebook: notebook.displayName || '未命名笔记本',
              section: section.displayName || '未命名分区',
              pageTitle: page.title || '无标题',
              pageId: page.id,
              pageUrl: page.links?.oneNoteWebUrl?.href || '',
              modifiedAt: page.lastModifiedDateTime
            });

            if (stored > 0) added++;

            // 7. 保存页面元数据到微信云开发
            await db.collection('note_metadata').doc(page.id).set({
              data: {
                page_id: page.id,
                notebook: notebook.displayName || '',
                section: section.displayName || '',
                title: page.title || '',
                text_content: textContent.substring(0, 50000),  // 限制大小
                modified_at: page.lastModifiedDateTime,
                synced_at: new Date()
              }
            });

          } catch (pageErr) {
            console.error(`Page ${page.id} sync error:`, pageErr.message);
            errors++;
          }
        }
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    // 记录同步日志
    await db.collection('sync_logs').add({
      data: {
        syncTime: new Date(),
        type: 'incremental',
        added,
        updated,
        deleted: 0,
        errors,
        duration,
        status: errors > 0 ? 'partial' : 'success'
      }
    });

    return {
      code: 0,
      data: { added, updated, errors, duration },
      message: `同步完成：新增 ${added} 篇，${errors > 0 ? errors + ' 篇出错' : '全部成功'}`
    };

  } catch (err) {
    console.error('syncNotes error:', err);
    return { code: 500, message: `同步失败：${err.message}` };
  }
};
```

> ⚠️ 注意：`await await` 是笔误，实际部署时修正为 `await getValidToken()`。

- [ ] **Step 2: 提交**

```bash
cd /home/mac/tiangong-assistant
git add cloudfunctions/syncNotes/
git commit -m "feat: add OneNote sync cloud function with HTML cleaning and chunking"
```

---

## Task 10: 云函数 — RAG 问答（askQuestion）

**Files:**
- Create: `tiangong-assistant/cloudfunctions/askQuestion/index.js`

- [ ] **Step 1: 创建 askQuestion/index.js**

```js
// cloudfunctions/askQuestion/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_EMBED_URL = 'https://api.deepseek.com/v1/embeddings';
const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/v1/chat/completions';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

const TOP_K = 5;
const SIMILARITY_THRESHOLD = 0.7;

async function getQueryEmbedding(question) {
  const res = await fetch(DEEPSEEK_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: question
    })
  });

  if (!res.ok) throw new Error('Embedding 请求失败');
  const data = await res.json();
  return data.data[0].embedding;
}

async function searchRelevantChunks(queryVector) {
  // 使用 Supabase RPC 进行向量检索
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_note_chunks`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query_embedding: JSON.stringify(queryVector),
      match_threshold: SIMILARITY_THRESHOLD,
      match_count: TOP_K
    })
  });

  if (!res.ok) {
    // 如果 RPC 不存在，降级为直接 SQL 查询
    const fallbackRes = await fetch(
      `${SUPABASE_URL}/rest/v1/note_chunks?select=id,content,notebook,section,page_title,page_url&embedding=${encodeURIComponent(JSON.stringify(queryVector))}&limit=${TOP_K}`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );
    if (!fallbackRes.ok) throw new Error('向量检索失败');
    return (await fallbackRes.json()).filter(c => (c.similarity || 0) >= SIMILARITY_THRESHOLD);
  }

  return await res.json();
}

async function callDeepSeek(messages) {
  const res = await fetch(DEEPSEEK_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      max_tokens: 2000,
      temperature: 0.3,
      stream: false
    })
  });

  if (!res.ok) throw new Error('DeepSeek API 请求失败');
  const data = await res.json();
  return data.choices[0].message.content;
}

exports.main = async (event, context) => {
  const { question, conversationId } = event;

  if (!question || !question.trim()) {
    return { code: 400, message: '问题不能为空' };
  }

  try {
    // 1. 问题向量化
    const queryVector = await getQueryEmbedding(question.trim());

    // 2. 向量检索
    const chunks = await searchRelevantChunks(queryVector);

    if (!chunks || chunks.length === 0) {
      return {
        code: 0,
        data: {
          answer: '抱歉，我在你的笔记中没有找到与这个问题相关的内容。请尝试换一种问法，或确认相关笔记已同步。',
          sources: []
        }
      };
    }

    // 3. 组装 prompt
    const contextStr = chunks.map((c, i) =>
      `【片段 ${i + 1}】\n${c.content}\n来源：《${c.notebook || ''}》/ ${c.section || ''} / ${c.page_title || ''}`
    ).join('\n\n');

    const systemPrompt = `你是一个个人知识库助手。根据以下笔记内容回答用户的问题。

规则：
1. 仅基于提供的笔记内容回答，不要编造信息
2. 如果笔记中没有相关信息，请如实说明
3. 回答要简洁、准确、有条理
4. 回答末尾标注引用的来源编号

=== 相关笔记片段 ===

${contextStr}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question.trim() }
    ];

    // 4. 调用 DeepSeek 生成回答
    const answer = await callDeepSeek(messages);

    // 5. 整理来源
    const sources = chunks.map(c => ({
      notebook: c.notebook || '',
      section: c.section || '',
      page_title: c.page_title || '',
      page_url: c.page_url || '',
      similarity: c.similarity || 0
    }));

    return {
      code: 0,
      data: {
        answer,
        sources,
        chunksUsed: chunks.length
      }
    };

  } catch (err) {
    console.error('askQuestion error:', err);
    return { code: 500, message: `问答服务异常：${err.message}` };
  }
};
```

- [ ] **Step 2: 创建 Supabase RPC 函数**

在 `supabase/migrations/` 中追加 `002_rpc.sql`：

```sql
-- supabase/migrations/002_rpc.sql

-- 向量检索 RPC 函数
CREATE OR REPLACE FUNCTION search_note_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id bigint,
  content text,
  notebook text,
  section text,
  page_title text,
  page_url text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    nc.id,
    nc.content,
    nc.notebook,
    nc.section,
    nc.page_title,
    nc.page_url,
    1 - (nc.embedding <=> query_embedding) AS similarity
  FROM note_chunks nc
  WHERE 1 - (nc.embedding <=> query_embedding) > match_threshold
  ORDER BY nc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

- [ ] **Step 3: 提交**

```bash
cd /home/mac/tiangong-assistant
git add cloudfunctions/askQuestion/index.js supabase/migrations/002_rpc.sql
git commit -m "feat: add RAG Q&A cloud function with vector search"
```

---

## Task 11: 云函数 — 笔记数据查询（getNotebooks / getPages / getPageDetail / getSyncLogs）

**Files:**
- Create: `tiangong-assistant/cloudfunctions/getNotebooks/index.js`
- Create: `tiangong-assistant/cloudfunctions/getPages/index.js`
- Create: `tiangong-assistant/cloudfunctions/getPageDetail/index.js`
- Create: `tiangong-assistant/cloudfunctions/getSyncLogs/index.js`

- [ ] **Step 1: 创建 getNotebooks/index.js**

```js
// cloudfunctions/getNotebooks/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    // 从微信云开发读取已同步的笔记本列表
    const meta = await db.collection('note_metadata')
      .field({ notebook: true, section: true, page_id: true })
      .get();

    // 按笔记本聚合
    const notebookMap = {};
    for (const item of meta.data) {
      const nb = item.notebook || '未命名';
      if (!notebookMap[nb]) {
        notebookMap[nb] = { name: nb, pageCount: 0, sections: {} };
      }
      notebookMap[nb].pageCount++;
      const sec = item.section || '未命名';
      if (!notebookMap[nb].sections[sec]) {
        notebookMap[nb].sections[sec] = { name: sec, pageCount: 0 };
      }
      notebookMap[nb].sections[sec].pageCount++;
    }

    const notebooks = Object.values(notebookMap).map(nb => ({
      ...nb,
      sections: Object.values(nb.sections)
    }));

    return { code: 0, data: { notebooks } };
  } catch (err) {
    console.error('getNotebooks error:', err);
    return { code: 500, message: '获取笔记本列表失败' };
  }
};
```

- [ ] **Step 2: 创建 getPages/index.js**

```js
// cloudfunctions/getPages/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { sectionId, notebookName, sectionName } = event;

  try {
    const query = {};
    if (notebookName) query.notebook = notebookName;
    if (sectionName) query.section = sectionName;

    const pages = await db.collection('note_metadata')
      .where(query)
      .field({
        page_id: true,
        notebook: true,
        section: true,
        title: true,
        modified_at: true
      })
      .orderBy('modified_at', 'desc')
      .get();

    return { code: 0, data: { pages: pages.data } };
  } catch (err) {
    console.error('getPages error:', err);
    return { code: 500, message: '获取页面列表失败' };
  }
};
```

- [ ] **Step 3: 创建 getPageDetail/index.js**

```js
// cloudfunctions/getPageDetail/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { pageId } = event;

  if (!pageId) return { code: 400, message: '缺少 pageId' };

  try {
    const page = await db.collection('note_metadata').doc(pageId).get();

    if (!page.data) {
      return { code: 404, message: '页面不存在' };
    }

    // 提取附件信息（从 text_content 中解析）
    const textContent = page.data.text_content || '';
    const attachments = [];
    const linkRegex = /([^:]+):\s*(https?:\/\/[^\s]+)/g;
    let match;
    while ((match = linkRegex.exec(textContent)) !== null) {
      if (!match[1].startsWith('#') && match[2].includes('onenote')) {
        attachments.push({ name: match[1].trim(), url: match[2].trim() });
      }
    }

    return {
      code: 0,
      data: {
        id: page.data.page_id,
        title: page.data.title,
        notebook: page.data.notebook,
        section: page.data.section,
        textContent: page.data.text_content,
        attachments,
        lastModifiedDateTime: page.data.modified_at,
        oneNoteUrl: page.data.page_url || ''
      }
    };
  } catch (err) {
    console.error('getPageDetail error:', err);
    return { code: 500, message: '获取页面详情失败' };
  }
};
```

- [ ] **Step 4: 创建 getSyncLogs/index.js**

```js
// cloudfunctions/getSyncLogs/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { limit = 20 } = event;

  try {
    const logs = await db.collection('sync_logs')
      .orderBy('syncTime', 'desc')
      .limit(limit)
      .get();

    // 获取最新同步统计
    const latestLog = logs.data[0];
    const totalChunks = latestLog?.totalChunks || 0;

    return {
      code: 0,
      data: {
        logs: logs.data,
        totalChunks,
        lastSyncTime: latestLog?.syncTime || null
      }
    };
  } catch (err) {
    console.error('getSyncLogs error:', err);
    return { code: 500, message: '获取同步日志失败' };
  }
};
```

- [ ] **Step 5: 提交**

```bash
cd /home/mac/tiangong-assistant
git add cloudfunctions/getNotebooks/ cloudfunctions/getPages/ cloudfunctions/getPageDetail/ cloudfunctions/getSyncLogs/
git commit -m "feat: add note browsing cloud functions"
```

---

## Task 12: 云函数 — 清空知识库（clearKnowledgeBase）

**Files:**
- Create: `tiangong-assistant/cloudfunctions/clearKnowledgeBase/index.js`

- [ ] **Step 1: 创建 clearKnowledgeBase/index.js**

```js
// cloudfunctions/clearKnowledgeBase/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

exports.main = async (event, context) => {
  try {
    // 1. 清空 Supabase 向量库
    await fetch(`${SUPABASE_URL}/rest/v1/note_chunks?id=gt.0`, {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    });

    // 2. 清空微信云开发中的笔记元数据
    // 分批删除（微信云开发限制单次查询数量)
    let hasMore = true;
    while (hasMore) {
      const batch = await db.collection('note_metadata').limit(500).get();
      if (batch.data.length === 0) {
        hasMore = false;
        break;
      }
      for (const item of batch.data) {
        await db.collection('note_metadata').doc(item._id).remove();
      }
      if (batch.data.length < 500) hasMore = false;
    }

    // 3. 清空同步日志
    let clearLogs = true;
    while (clearLogs) {
      const logBatch = await db.collection('sync_logs').limit(500).get();
      if (logBatch.data.length === 0) {
        clearLogs = false;
        break;
      }
      for (const item of logBatch.data) {
        await db.collection('sync_logs').doc(item._id).remove();
      }
      if (logBatch.data.length < 500) clearLogs = false;
    }

    return { code: 0, data: null, message: '知识库已清空' };
  } catch (err) {
    console.error('clearKnowledgeBase error:', err);
    return { code: 500, message: '清空失败' };
  }
};
```

- [ ] **Step 2: 提交**

```bash
cd /home/mac/tiangong-assistant
git add cloudfunctions/clearKnowledgeBase/
git commit -m "feat: add clear knowledge base cloud function"
```

---

## Task 13: 环境配置与部署文档

**Files:**
- Create: `tiangong-assistant/docs/setup-guide.md`
- Create: `tiangong-assistant/.env.example`

- [ ] **Step 1: 创建 .env.example**

```bash
# .env.example — 复制为 .env.local 并填入实际值

# === Supabase ===
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# === DeepSeek ===
DEEPSEEK_API_KEY=sk-your-deepseek-key

# === Microsoft Azure ===
AZURE_CLIENT_ID=your-azure-app-client-id
AZURE_CLIENT_SECRET=your-azure-app-client-secret
AZURE_TENANT_ID=common

# === 微信云开发 ===
# 在微信开发者工具中配置云环境 ID
WECHAT_CLOUD_ENV=your-env-id
```

- [ ] **Step 2: 创建 setup-guide.md**

```markdown
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
```

- [ ] **Step 3: 提交**

```bash
cd /home/mac/tiangong-assistant
git add docs/setup-guide.md .env.example
git commit -m "docs: add setup and deployment guide"
```

---

## Task 14: 修复 syncNotes 中的笔误

**Files:**
- Modify: `tiangong-assistant/cloudfunctions/syncNotes/index.js:156`

- [ ] **Step 1: 修复 `await await` 为 `await`**

将 syncNotes/index.js 中的：
```js
const token = await await getValidToken();
```
修改为：
```js
const token = await getValidToken();
```

- [ ] **Step 2: 提交**

```bash
cd /home/mac/tiangong-assistant
git add cloudfunctions/syncNotes/index.js
git commit -m "fix: remove duplicate await in syncNotes"
```

---

## 执行顺序总结

| 顺序 | Task | 内容 | 可独立验证 |
|------|------|------|-----------|
| 1 | Task 1 | Supabase 数据库初始化 | ✅ 执行 SQL |
| 2 | Task 2 | 小程序项目框架 | ✅ 编译通过 |
| 3 | Task 3 | 首页 | ✅ 页面展示 |
| 4 | Task 4 | 对话页 | ✅ UI 交互 |
| 5 | Task 5 | 笔记浏览 + 详情 | ✅ 页面展示 |
| 6 | Task 6 | 同步管理页 | ✅ 页面展示 |
| 7 | Task 7 | 设置页 | ✅ 页面展示 |
| 8 | Task 8 | 云函数 — OneNote 授权 | ✅ 调云函数 |
| 9 | Task 9 | 云函数 — 笔记同步 | ✅ 同步测试 |
| 10 | Task 10 | 云函数 — RAG 问答 | ✅ 问答测试 |
| 11 | Task 11 | 云函数 — 数据查询 | ✅ 接口测试 |
| 12 | Task 12 | 云函数 — 清空知识库 | ✅ 功能测试 |
| 13 | Task 13 | 部署文档 | ✅ 文档检查 |
| 14 | Task 14 | Bug 修复 | ✅ 代码检查 |
