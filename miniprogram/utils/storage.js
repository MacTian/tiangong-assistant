// miniprogram/utils/storage.js
const KEYS = {
  CONVERSATIONS: 'conversations',
  LAST_SYNC: 'lastSync',
  AUTH_STATUS: 'authStatus'
};

module.exports = {
  saveConversation(conversation) {
    const list = this.getConversations();
    const idx = list.findIndex(c => c.id === conversation.id);
    if (idx >= 0) {
      list[idx] = conversation;
    } else {
      list.unshift(conversation);
    }
    if (list.length > 20) list.pop();
    wx.setStorageSync(KEYS.CONVERSATIONS, list);
  },

  getConversations() {
    return wx.getStorageSync(KEYS.CONVERSATIONS) || [];
  },

  getConversation(id) {
    const list = this.getConversations();
    return list.find(c => c.id === id) || null;
  },

  saveLastSync(time) {
    wx.setStorageSync(KEYS.LAST_SYNC, time);
  },

  getLastSync() {
    return wx.getStorageSync(KEYS.LAST_SYNC) || null;
  },

  saveAuthStatus(status) {
    wx.setStorageSync(KEYS.AUTH_STATUS, status);
  },

  getAuthStatus() {
    return wx.getStorageSync(KEYS.AUTH_STATUS) || { connected: false };
  }
};
