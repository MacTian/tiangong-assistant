#!/usr/bin/env node
/**
 * 天工助手 - OneNote 笔记批量导入工具
 * 用法：node upload-notes.js <markdown文件夹路径>
 *
 * 依赖：dotenv, axios, fs-extra
 * 安装：npm install dotenv axios fs-extra
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !DEEPSEEK_API_KEY) {
  console.error('❌ 错误：请先创建 .env.local 文件并填写环境变量');
  console.error('示例：');
  console.error('  SUPABASE_URL=https://xxx.supabase.co');
  console.error('  SUPABASE_SERVICE_KEY=你的service_role_key');
  console.error('  DEEPSEEK_API_KEY=sk-xxx');
  process.exit(1);
}

// 1. DeepSeek 向量化
async function getEmbedding(text) {
  try {
    const res = await axios.post(
      'https://api.deepseek.com/v1/embeddings',
      {
        model: 'text-embedding-3-small',
        input: text
      },
      {
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    return res.data.data[0].embedding;
  } catch (err) {
    console.error('  ⚠️  向量化失败:', err.response?.data || err.message);
    throw err;
  }
}

// 2. 分块算法
function splitIntoChunks(content) {
  const chunks = [];

  // 按标题切分
  const sections = content.split(/^#+\s+/m);

  for (let section of sections) {
    if (!section.trim()) continue;

    // 小段直接保留
    if (section.length <= 600) {
      if (section.trim().length >= 30) {
        chunks.push(section.trim());
      }
      continue;
    }

    // 长段再按句子切分
    const sentences = section.split(/(?<=[。！？!?\n])\s+/);
    let currentChunk = '';

    for (const sent of sentences) {
      if ((currentChunk + sent).length > 550) {
        if (currentChunk.trim().length >= 30) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sent;
      } else {
        currentChunk += sent;
      }
    }

    if (currentChunk.trim().length >= 30) {
      chunks.push(currentChunk.trim());
    }
  }

  return chunks;
}

// 3. 读取文件夹中所有 .md 文件
function getAllMarkdownFiles(dir) {
  const files = [];

  function scan(currentDir, relPath = '') {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scan(fullPath, path.join(relPath, item));
      } else if (item.endsWith('.md')) {
        files.push({
          path: fullPath,
          relPath: path.join(relPath, item)
        });
      }
    }
  }

  scan(dir);
  return files;
}

// 4. 从文件路径推断元数据
function parseMetadata(relPath) {
  const parts = relPath.split(path.sep);

  // 格式：笔记本/分区/页面.md
  let notebook = '未命名笔记本';
  let section = '未命名分区';
  let title = '未命名页面';

  if (parts.length >= 1) {
    title = parts[parts.length - 1].replace(/\.md$/, '').trim();
  }
  if (parts.length >= 2) {
    section = parts[parts.length - 2].trim();
  }
  if (parts.length >= 3) {
    notebook = parts[parts.length - 3].trim();
  }

  return { notebook, section, title };
}

// 5. 批量上传到 Supabase
async function upsertToSupabase(rows) {
  if (rows.length === 0) return 0;

  try {
    // 先删除同 page_id 的旧数据（如果有）
    for (const row of rows) {
      await axios.delete(
        `${SUPABASE_URL}/rest/v1/note_chunks?page_id=eq.${encodeURIComponent(row.page_id)}`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            Prefer: 'return=minimal'
          }
        }
      ).catch(() => {}); // 忽略失败
    }

    // 批量插入
    const res = await axios.post(
      `${SUPABASE_URL}/rest/v1/note_chunks`,
      rows,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        }
      }
    );

    return rows.length;
  } catch (err) {
    console.error('  ⚠️  数据库插入失败:', err.response?.data || err.message);
    return 0;
  }
}

// 主流程
async function main() {
  const notesDir = process.argv[2];

  if (!notesDir) {
    console.error('❌ 用法: node upload-notes.js <markdown文件夹路径>');
    console.error('示例: node upload-notes.js ~/Downloads/我的笔记');
    process.exit(1);
  }

  if (!fs.existsSync(notesDir)) {
    console.error(`❌ 目录不存在: ${notesDir}`);
    process.exit(1);
  }

  console.log('🚀 开始导入笔记...');
  console.log('📁 目录:', notesDir);
  console.log('');

  const files = getAllMarkdownFiles(notesDir);
  console.log(`📄 找到 ${files.length} 个 Markdown 文件`);
  console.log('');

  let totalChunks = 0;
  let totalFailed = 0;
  let processedFiles = 0;

  for (const file of files) {
    processedFiles++;
    console.log(`[${processedFiles}/${files.length}] 处理: ${file.relPath}`);

    try {
      const content = fs.readFileSync(file.path, 'utf-8');
      const chunks = splitIntoChunks(content);
      const metadata = parseMetadata(file.relPath);

      if (chunks.length === 0) {
        console.log('  ⏭  无有效内容，跳过');
        continue;
      }

      const rows = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`  🔄 向量化 chunk ${i + 1}/${chunks.length}...`);

        try {
          const embedding = await getEmbedding(chunk);
          rows.push({
            content: chunk,
            embedding,
            notebook: metadata.notebook,
            section: metadata.section,
            page_title: metadata.title,
            page_id: `${metadata.notebook}-${metadata.section}-${metadata.title}`,
            page_url: '',
            modified_at: new Date().toISOString()
          });
        } catch (err) {
          totalFailed++;
          console.log(`  ⚠️  第 ${i + 1} 个 chunk 失败，跳过`);
        }

        // 避免 API 限流
        await new Promise(r => setTimeout(r, 200));
      }

      // 上传到 Supabase
      const batchSize = 50;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const count = await upsertToSupabase(batch);
        totalChunks += count;
        console.log(`  📥 上传到数据库 (批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(rows.length / batchSize)})`);

        if (i + batchSize < rows.length) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      console.log(`  ✅ 完成! (${rows.length} 个片段)`);

    } catch (err) {
      console.error(`  ❌ 处理失败: ${err.message}`);
      totalFailed++;
    }

    console.log('');
  }

  console.log('📊 ===== 导入完成 =====');
  console.log(`📄 文件总数: ${files.length}`);
  console.log(`✅ 成功片段: ${totalChunks}`);
  console.log(`❌ 失败文件: ${totalFailed}`);
  console.log('');
  console.log('✨ 现在可以在小程序中提问了!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
