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
