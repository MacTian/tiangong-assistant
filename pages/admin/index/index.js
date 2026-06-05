const licenseApi = require('../../../utils/license-api')

Page({
  data: {
    isLoggedIn: false,
    stats: { pending: 0, active: 0, revoked: 0 }
  },

  onShow() {
    const loggedIn = licenseApi.isLoggedIn()
    this.setData({ isLoggedIn: loggedIn })
    if (loggedIn) {
      this.loadStats()
    }
  },

  async loadStats() {
    try {
      const [requests, licenses] = await Promise.all([
        licenseApi.getRequests(),
        licenseApi.getLicenses()
      ])

      const pending = Array.isArray(requests) ? requests.length : (requests.data?.length || 0)
      const licenseList = Array.isArray(licenses) ? licenses : (licenses.data || [])
      const active = licenseList.filter(l => l.status === 0).length
      const revoked = licenseList.filter(l => l.status === 1).length

      this.setData({ stats: { pending, active, revoked } })
    } catch (err) {
      console.error('加载统计失败:', err)
    }
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/admin/login/login' })
  },

  goPage(e) {
    const page = e.currentTarget.dataset.page
    wx.navigateTo({ url: `/pages/admin/${page}/${page}` })
  },

  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          licenseApi.clearToken()
          this.setData({ isLoggedIn: false, stats: { pending: 0, active: 0, revoked: 0 } })
          wx.showToast({ title: '已退出', icon: 'none' })
        }
      }
    })
  }
})
