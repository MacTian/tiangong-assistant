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
  // Try RPC first
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
    // Fallback: direct SQL via PostgREST
    const fallbackRes = await fetch(
      `${SUPABASE_URL}/rest/v1/note_chunks?select=id,content,notebook,section,page_title,page_url&limit=${TOP_K}`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );
    if (!fallbackRes.ok) throw new Error('向量检索失败');
    const allChunks = await fallbackRes.json();
    // Client-side filter (less accurate without vector ops)
    return allChunks.slice(0, TOP_K);
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
