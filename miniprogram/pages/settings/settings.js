// miniprogram/pages/settings/settings.js
const api = require('../../utils/api');
const storage = require('../../utils/storage');

Page({
  data: {
    authConnected: false
  },

  onLoad() {
    this.checkAuth();
  },

  onShow() {
    this.checkAuth();
  },

  checkAuth() {
    const status = storage.getAuthStatus();
    this.setData({ authConnected: status.connected });
  },

  async onAuthTap() {
    if (this.data.authConnected) {
      wx.showModal({
        title: '重新授权',
        content: '确定要重新连接 OneNote 吗？',
        success: async (res) => {
          if (res.confirm) {
            await this.startAuth();
          }
        }
      });
    } else {
      await this.startAuth();
    }
  },

  async startAuth() {
    try {
      wx.showLoading({ title: '正在获取授权码...' });
      const data = await api.authDeviceCode();
      wx.hideLoading();

      wx.showModal({
        title: '请在浏览器中授权',
        content: `设备码：${data.userCode}\n\n请在浏览器打开：${data.verificationUrl}`,
        confirmText: '复制设备码',
        success: (res) => {
          if (res.confirm) {
            wx.setClipboardData({ data: data.userCode });
          }
        }
      });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '授权请求失败', icon: 'none' });
    }
  },

  onClearTap() {
    wx.showModal({
      title: '清空知识库',
      content: '确定要清空所有已同步的笔记数据吗？此操作不可恢复。',
      confirmText: '确认清空',
      confirmColor: '#fa5151',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.clearKnowledgeBase();
            storage.saveLastSync(null);
            wx.showToast({ title: '已清空', icon: 'success' });
          } catch (e) {
            wx.showToast({ title: '操作失败', icon: 'none' });
          }
        }
      }
    });
  },

  onAboutTap() {
    wx.showModal({
      title: '关于天工助手',
      content: '天工助手 v1.0.0\n\n将 OneNote 笔记构建为个人知识库，支持自然语言问答。\n\n技术栈：微信小程序 + 微信云开发 + Supabase + DeepSeek',
      showCancel: false
    });
  }
});
