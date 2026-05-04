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
