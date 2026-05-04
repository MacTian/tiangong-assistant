// miniprogram/pages/note-detail/note-detail.js
const api = require('../../utils/api');
const { formatDate } = require('../../utils/format');

Page({
  data: {
    loading: true,
    pageDetailMode: false,
    sectionId: '',
    notebookId: '',
    sectionName: '',
    notebookName: '',
    pages: [],
    currentPage: null
  },

  onLoad(options) {
    this.setData({
      sectionId: options.sectionId,
      notebookId: options.notebookId,
      sectionName: options.sectionName,
      notebookName: options.notebookName
    });
    this.loadPages();
  },

  async loadPages() {
    this.setData({ loading: true });
    try {
      const data = await api.getPages(this.data.sectionId, this.data.notebookId);
      const pages = (data.pages || []).map(p => ({
        ...p,
        modifiedDate: formatDate(p.lastModifiedDateTime)
      }));
      this.setData({ pages, loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async onPageTap(e) {
    const item = e.currentTarget.dataset.item;
    try {
      const data = await api.getPageDetail(item.id);
      this.setData({
        pageDetailMode: true,
        currentPage: {
          title: data.title || item.title,
          textContent: data.textContent || '（无文本内容）',
          attachments: data.attachments || [],
          modifiedDate: formatDate(data.lastModifiedDateTime || item.lastModifiedDateTime),
          oneNoteUrl: data.oneNoteUrl || ''
        }
      });
      wx.setNavigationBarTitle({ title: data.title || item.title });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onAttachmentTap(e) {
    const url = e.currentTarget.dataset.url;
    wx.setClipboardData({
      data: url,
      success() {
        wx.showToast({ title: '链接已复制', icon: 'success' });
      }
    });
  },

  openInOneNote() {
    const url = this.data.currentPage?.oneNoteUrl;
    if (url) {
      wx.setClipboardData({
        data: url,
        success() {
          wx.showToast({ title: 'OneNote 链接已复制', icon: 'success' });
        }
      });
    } else {
      wx.showToast({ title: '无法打开', icon: 'none' });
    }
  }
});
