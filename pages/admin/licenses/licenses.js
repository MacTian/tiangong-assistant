const licenseApi = require('../../../utils/license-api')

Page({
  data: {
    loading: true,
    list: []
  },

  onLoad() {
    this.loadData()
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      const res = await licenseApi.getLicenses()
      const list = (Array.isArray(res) ? res : (res.data || [])).map(item => ({
        ...item,
        createdAtFormatted: this.formatTime(item.createdAt),
        expiresAtFormatted: item.expiresAt ? this.formatTime(item.expiresAt) : '永久'
      }))
      this.setData({ list, loading: false })
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: err.message, icon: 'none' })
    }
  },

  formatTime(str) {
    if (!str) return ''
    const d = new Date(str)
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  },

  onRevoke(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.list[index]
    if (!item) return

    wx.showModal({
      title: '确认吊销',
      content: `确定吊销授权码 ${item.Code} 吗？吊销后该授权码将无法使用。`,
      success: async (res) => {
        if (res.confirm) {
          try {
            await licenseApi.revokeLicense(item.Code)
            wx.showToast({ title: '已吊销', icon: 'success' })
            this.loadData()
          } catch (err) {
            wx.showToast({ title: err.message, icon: 'none' })
          }
        }
      }
    })
  }
})
