// miniprogram/pages/sync/sync.js
const api = require('../../utils/api');
const storage = require('../../utils/storage');
const { formatDate, formatTime } = require('../../utils/format');

Page({
  data: {
    syncing: false,
    lastSyncTime: '',
    notebooks: [],
    logs: []
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    const lastSync = storage.getLastSync();
    this.setData({
      lastSyncTime: lastSync ? `${formatDate(lastSync)} ${formatTime(lastSync)}` : ''
    });

    try {
      const data = await api.getSyncLogs(20);
      const logs = (data.logs || []).map(l => ({
        ...l,
        time: l.syncTime ? `${formatDate(l.syncTime)} ${formatTime(l.syncTime)}` : ''
      }));
      this.setData({ logs });
    } catch (e) {
      // ignore
    }

    try {
      const nbData = await api.getNotebooks();
      const notebooks = (nbData.notebooks || []).map(nb => ({
        ...nb,
        syncEnabled: true
      }));
      this.setData({ notebooks });
    } catch (e) {
      // ignore
    }
  },

  async onSyncTap() {
    if (this.data.syncing) return;
    this.setData({ syncing: true });

    try {
      const result = await api.syncNotes();
      storage.saveLastSync(new Date().toISOString());
      wx.showToast({ title: '同步完成', icon: 'success' });
      this.loadData();
    } catch (e) {
      wx.showToast({ title: e.message || '同步失败', icon: 'none' });
    } finally {
      this.setData({ syncing: false });
    }
  },

  toggleNotebook(e) {
    const idx = e.currentTarget.dataset.index;
    const key = `notebooks[${idx}].syncEnabled`;
    this.setData({ [key]: !this.data.notebooks[idx].syncEnabled });
  }
});
