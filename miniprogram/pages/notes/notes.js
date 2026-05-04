// miniprogram/pages/notes/notes.js
const api = require('../../utils/api');

Page({
  data: {
    loading: true,
    notebooks: []
  },

  onLoad() {
    this.loadNotebooks();
  },

  onShow() {
    this.loadNotebooks();
  },

  async loadNotebooks() {
    this.setData({ loading: true });
    try {
      const data = await api.getNotebooks();
      const notebooks = (data.notebooks || []).map(nb => ({
        ...nb,
        expanded: false,
        sections: []
      }));
      this.setData({ notebooks, loading: false });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async toggleNotebook(e) {
    const idx = e.currentTarget.dataset.index;
    const notebooks = [...this.data.notebooks];
    notebooks[idx].expanded = !notebooks[idx].expanded;

    if (notebooks[idx].expanded && notebooks[idx].sections.length === 0) {
      try {
        const sectionData = await api.getPages(null, notebooks[idx].id);
        notebooks[idx].sections = sectionData.sections || [];
      } catch (err) {
        notebooks[idx].sections = [];
      }
    }

    this.setData({ notebooks });
  },

  onSectionTap(e) {
    const section = e.currentTarget.dataset.section;
    const notebook = e.currentTarget.dataset.notebook;
    wx.navigateTo({
      url: `/pages/note-detail/note-detail?sectionId=${section.id}&notebookId=${notebook.id}&sectionName=${section.name}&notebookName=${notebook.name}`
    });
  }
});
