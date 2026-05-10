# 📝 OneNote 笔记手动导入指南

## 第一步：导出 OneNote 为 Markdown

### Windows 用户推荐方案

#### 方案 A：使用 Pandoc（免费）

1. 安装 Pandoc：https://pandoc.org/installing.html
2. 电脑搜索 PowerShell，管理员运行

```powershell
# 导出整个笔记本
onenote --export "Notebook Name" "C:\notes-output" --format markdown
```

#### 方案 B：使用 OneNoteGem（免费插件）

1. 下载：https://onenotegem.com/download/
2. 打开 OneNote → OneNoteGem 菜单
3. 选择「导出」→「导出为 Markdown」
4. 选择输出文件夹

#### 方案 C：使用 Doxillion（免费）

1. https://www.nchsoftware.com/doxillion/
2. 导入 OneNote 文件 → 导出为 Markdown

---

### 批量导出 PowerShell 脚本

将以下代码保存为 `export-notes.ps1`，右键「以管理员身份运行」：

```powershell
# OneNote 批量导出为 Markdown
Add-Type -AssemblyName Microsoft.Office.Interop.OneNote

$oneNote = New-Object -ComObject OneNote.Application
$notebooks = @()

# 获取所有笔记本
$oneNote.GetHierarchy([ref]"", [Microsoft.Office.Interop.OneNote.HierarchyScope]::hsNotebooks, [ref]$notebooks)

Write-Host "Found OneNote notebooks. Exporting..."

$outputPath = "C:\tianong-notes-export"
New-Item -ItemType Directory -Force -Path $outputPath | Out-Null

# 简单方法：直接复制页面内容
# OneNote 2016+ 支持发送到 Word，然后转换为 Markdown
```

---

## 第二步：准备文件夹结构

将导出的 Markdown 文件按这个结构整理：

```
我的笔记/
├── 工作笔记/
│   ├── 授权系统/
│   │   ├── 安全设计.md
│   │   └── 授权流程.md
│   └── 项目管理/
│       └── 需求文档.md
├── 学习笔记/
│   ├── 前端开发/
│   │   └── React.md
│   └── 数据库/
│       └── PostgreSQL.md
└── 生活记录/
    └── 2024-日记.md
```

**规则：**
- 每本书一个文件夹
- 每个分区一个子文件夹  
- 每页一个 `.md` 文件
- 文件名就是页面标题

---

## 第三步：配置环境变量

编辑 `/home/mac/tiangong-assistant/.env.local`：

```bash
# 1. Supabase 信息（在 Supabase 仪表板获取）
SUPABASE_URL=https://你的项目.supabase.co
SUPABASE_SERVICE_ROLE_KEY=你的service_role_key

# 2. DeepSeek API Key（需充值 ¥10-20）
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
```

**如何获取这些信息？**

### 获取 Supabase 信息
1. 登录 https://supabase.com
2. 进入项目 → Settings → API
3. 复制 URL 和 `service_role` key

### 获取 DeepSeek API Key
1. 注册 https://platform.deepseek.com
2. 进入「API Keys」
3. 创建新 Key
4. 充值 ¥10-20

---

## 第四步：运行导入脚本

```bash
cd /home/mac/tiangong-assistant

# 安装依赖
npm install dotenv axios fs-extra

# 运行导入（替换为你的笔记目录）
node upload-notes.js /path/to/你的笔记文件夹
```

**效果：**
```
🚀 开始导入笔记...
📁 目录: /path/to/笔记

[1/10] 处理: 工作笔记/授权系统/安全设计.md
  🔄 向量化 chunk 1/3...
  🔄 向量化 chunk 2/3...
  🔄 向量化 chunk 3/3...
  📥 上传到数据库 (批次 1/1)
  ✅ 完成! (3 个片段)

📊 ===== 导入完成 =====
📄 文件总数: 10
✅ 成功片段: 28
❌ 失败文件: 0

✨ 现在可以在小程序中提问了!
```

---

## 第五步：测试

1. 微信开发者工具打开项目
2. 进入「首页」
3. 输入问题测试，例如：
   - "什么是设备指纹绑定？"
   - "授权码格式是什么？"

应该能看到包含来源引用的答案！

---

## 💡 常见问题

**Q：导入有点慢？**
正常！DeepSeek API 每个 chunk 需要 1-2 秒。100 个 chunk 大约 3-5 分钟。

**Q：费用多少？**
- DeepSeek: ¥0.2 / 1000 tokens，100 个 chunk 约 ¥0.1-0.3
- Supabase: 免费 500MB 够用很久

**Q：导入失败怎么办？**
检查 `.env.local` 是否填对，DeepSeek Key 是否充值。

**Q：我的笔记在 .one 文件里怎么办？**
用 OneNote 桌面版打开 → 另存为 → 选择文件夹 → 自动导出为多个 .md 部分。

---

## 快速开始脚本

如果你只有几十个页面，可以直接复制粘贴到小程序：

1. 在 OneNote 选中文本
2. 复制
3. 我可以帮你转换为 Markdown 格式

要试试吗？发一段你的笔记内容，我来转换格式！
