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
  getNotebooks() {
    return callCloudFunction('getNotebooks');
  },

  getPages(sectionId, notebookId) {
    return callCloudFunction('getPages', { sectionId, notebookId });
  },

  getPageDetail(pageId) {
    return callCloudFunction('getPageDetail', { pageId });
  },

  syncNotes() {
    return callCloudFunction('syncNotes');
  },

  getSyncLogs(limit = 20) {
    return callCloudFunction('getSyncLogs', { limit });
  },

  askQuestion(question, conversationId = null) {
    return callCloudFunction('askQuestion', { question, conversationId });
  },

  authDeviceCode() {
    return callCloudFunction('authDeviceCode');
  },

  clearKnowledgeBase() {
    return callCloudFunction('clearKnowledgeBase');
  }
};
