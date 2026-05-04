// miniprogram/pages/index/index.js
const api = require('../../utils/api');
const storage = require('../../utils/storage');
const { formatDate, generateId } = require('../../utils/format');

Page({
  data: {
    question: '',
    stats: { totalChunks: 0 },
    lastSyncText: '从未同步',
    authConnected: false,
    recentQuestions: []
  },

  onLoad() {
    this.loadStatus();
    this.loadRecentQuestions();
  },

  onShow() {
    this.loadStatus();
  },

  async loadStatus() {
    const authStatus = storage.getAuthStatus();
    const lastSync = storage.getLastSync();
    this.setData({
      authConnected: authStatus.connected,
      lastSyncText: lastSync ? formatDate(lastSync) : '从未同步'
    });

    try {
      const data = await api.getSyncLogs(1);
      if (data && data.totalChunks !== undefined) {
        this.setData({ stats: { totalChunks: data.totalChunks } });
      }
    } catch (e) {
      // ignore
    }
  },

  loadRecentQuestions() {
    const convs = storage.getConversations();
    const recent = convs.slice(0, 5).map(c => ({
      id: c.id,
      question: c.messages[0]?.content || '',
      date: formatDate(c.updatedAt)
    }));
    this.setData({ recentQuestions: recent });
  },

  onInput(e) {
    this.setData({ question: e.detail.value });
  },

  onSearch() {
    const q = this.data.question.trim();
    if (!q) {
      wx.showToast({ title: '请输入问题', icon: 'none' });
      return;
    }
    const convId = generateId();
    storage.saveConversation({
      id: convId,
      messages: [{ role: 'user', content: q, time: new Date().toISOString() }],
      sources: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    wx.navigateTo({ url: `/pages/chat/chat?id=${convId}` });
    this.setData({ question: '' });
  },

  onRecentTap(e) {
    const idx = e.currentTarget.dataset.index;
    const conv = this.data.recentQuestions[idx];
    wx.navigateTo({ url: `/pages/chat/chat?id=${conv.id}` });
  }
});
