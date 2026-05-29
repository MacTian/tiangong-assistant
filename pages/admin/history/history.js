const licenseApi = require('../../../utils/license-api')

Page({
  data: {
    loading: true,
    list: [],
    filter: 'all',
    filteredList: [],
    filterLabel: ''
  },

  onLoad() {
    this.loadData()
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      const res = await licenseApi.getHistory()
      const list = (Array.isArray(res) ? res : (res.data || [])).map(item => ({
        ...item,
        requestedAtFormatted: this.formatTime(item.RequestedAt)
      }))
      this.setData({ list, loading: false })
      this.applyFilter()
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

  setFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.filter })
    this.applyFilter()
  },

  applyFilter() {
    const { list, filter } = this.data
    const statusMap = { approved: 1, rejected: 2, expired: 3 }
    const labelMap = { all: '', approved: '已批准', rejected: '已拒绝', expired: '已过期' }

    let filtered = list
    if (filter !== 'all') {
      filtered = list.filter(item => item.Status === statusMap[filter])
    }

    this.setData({
      filteredList: filtered,
      filterLabel: labelMap[filter] || ''
    })
  }
})
