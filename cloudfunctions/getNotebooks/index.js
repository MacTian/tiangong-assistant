// cloudfunctions/getNotebooks/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const meta = await db.collection('note_metadata')
      .field({ notebook: true, section: true, page_id: true })
      .get();

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
