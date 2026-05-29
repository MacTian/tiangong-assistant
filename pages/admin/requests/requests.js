const licenseApi = require('../../../utils/license-api')

Page({
  data: {
    loading: true,
    list: [],
    showModal: false,
    currentIndex: -1,
    licenseType: 0,
    durationDays: 30,
    maxActivations: 1,
    notes: '',
    approving: false,
    durationOptions: [
      { label: '1天', value: 1 },
      { label: '7天', value: 7 },
      { label: '30天', value: 30 },
      { label: '90天', value: 90 },
      { label: '365天', value: 365 }
    ]
  },

  onLoad() {
    this.loadData()
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      const res = await licenseApi.getRequests()
      const list = (Array.isArray(res) ? res : (res.data || [])).map(item => ({
        ...item,
        requestedAtFormatted: this.formatTime(item.RequestedAt)
      }))
      this.setData({ list, loading: false })
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: err.message, icon: 'none' })
      if (err.message.includes('登录')) {
        setTimeout(() => wx.navigateTo({ url: '/pages/admin/login/login' }), 1500)
      }
    }
  },

  formatTime(str) {
    if (!str) return ''
    const d = new Date(str)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  },

  onApprove(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      showModal: true,
      currentIndex: index,
      licenseType: 0,
      durationDays: 30,
      maxActivations: 1,
      notes: ''
    })
  },

  closeModal() {
    this.setData({ showModal: false })
  },

  setType(e) {
    this.setData({ licenseType: parseInt(e.currentTarget.dataset.type) })
  },

  setDuration(e) {
    this.setData({ durationDays: parseInt(e.currentTarget.dataset.days) })
  },

  setMaxAct(e) {
    this.setData({ maxActivations: parseInt(e.detail.value) || 1 })
  },

  setNotes(e) {
    this.setData({ notes: e.detail.value })
  },

  async confirmApprove() {
    const { list, currentIndex, licenseType, durationDays, maxActivations, notes } = this.data
    const item = list[currentIndex]
    if (!item) return

    this.setData({ approving: true })
    try {
      await licenseApi.approveRequest({
        RequestCode: item.RequestCode,
        LicenseType: licenseType,
        DurationDays: licenseType === 0 ? durationDays : null,
        MaxActivations: maxActivations,
        Notes: notes
      })
      wx.showToast({ title: '已批准', icon: 'success' })
      this.setData({ showModal: false })
      this.loadData()
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' })
    } finally {
      this.setData({ approving: false })
    }
  },

  onReject(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.list[index]
    if (!item) return

    wx.showModal({
      title: '确认拒绝',
      content: `确定拒绝请求 ${item.RequestCode} 吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            await licenseApi.rejectRequest(item.RequestCode)
            wx.showToast({ title: '已拒绝', icon: 'success' })
            this.loadData()
          } catch (err) {
            wx.showToast({ title: err.message, icon: 'none' })
          }
        }
      }
    })
  }
})
