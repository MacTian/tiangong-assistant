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

    // 2. 清空微信云开发中的笔记元数据（分批删除）
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
