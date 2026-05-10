/**
 * 演示版上传脚本（使用模拟数据）
 * 用于展示整个流程，不需要真实的 API 密钥
 */

const fs = require('fs');
const path = require('path');

// 模拟数据生成
function simulateUpload(files) {
  console.log('🚀 演示模式：OneNote 笔记导入流程');
  console.log('📁 笔记目录:', process.argv[2]);
  console.log('');

  console.log('📄 发现 Markdown 文件:');
  files.forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.relPath}`);
  });
  console.log('');

  let totalChunks = 0;

  files.forEach((file, fileIdx) => {
    console.log(`[${fileIdx + 1}/${files.length}] 处理: ${file.relPath}`);

    const content = fs.readFileSync(file.path, 'utf-8');
    const chunks = content.split(/^#+\s+/m).filter(c => c.trim().length > 0);

    console.log(`  📄 提取 ${chunks.length} 个文本块`);
    console.log(`  🔄 模拟 DeepSeek 向量化...`);

    chunks.forEach((chunk, i) => {
      // 模拟 embedding（真实是 1536 维浮点数组）
      const mockEmbedding = Array(1536).fill(0).map(() => Math.random());
      const truncated = chunk.substring(0, 100).replace(/\n/g, ' ') + '...';
      console.log(`    ${i + 1}. ${truncated}`);
    });

    console.log(`  📥 模拟上传到 Supabase (${chunks.length} 个片段)`);
    console.log(`  ✅ 完成\n`);

    totalChunks += chunks.length;
  });

  console.log('📊 ===== 演示完成 =====');
  console.log(`✅ 成功片段: ${totalChunks}`);
  console.log('');
  console.log('✨ 工作流程:');
  console.log('  1. 读取 Markdown 文件 ✓');
  console.log('  2. 按标题智能分块 ✓');
  console.log('  3. DeepSeek 生成 1536-d 向量 ✓');
  console.log('  4. 存入 Supabase pgvector ✓');
  console.log('  5. 小程序聊天时使用向量检索 ✓');
  console.log('');
  console.log('📝 下一步:');
  console.log('  编辑 .env.local 填入真实的密钥');
  console.log('  运行: node upload-notes.js <真实笔记目录>');
  console.log('');
}

const notesDir = process.argv[2];

if (!notesDir || !fs.existsSync(notesDir)) {
  console.error('❌ 用法: node upload-notes-demo.js <markdown文件夹路径>');
  process.exit(1);
}

// 收集所有 .md 文件
const files = [];
function scan(dir, relPath = '') {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scan(fullPath, path.join(relPath, item));
    } else if (item.endsWith('.md')) {
      files.push({ path: fullPath, relPath: path.join(relPath, item) });
    }
  }
}

scan(notesDir);
simulateUpload(files);
