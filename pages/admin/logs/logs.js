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
      const res = await licenseApi.getLogs()
      const list = (Array.isArray(res) ? res : (res.data || [])).map(item => ({
        ...item,
        activatedAtFormatted: this.formatTime(item.activatedAt),
        lastVerifiedAtFormatted: item.lastVerifiedAt ? this.formatTime(item.lastVerifiedAt) : ''
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
  }
})
