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
