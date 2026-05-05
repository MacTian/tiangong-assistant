Page({
  data: {
    favorites: []
  },

  onShow() {
    // 每次页面显示时刷新收藏列表
    const app = getApp()
    this.setData({ favorites: app.globalData.favorites })
  },

  // 复制金句
  onCopy(e) {
    const text = e.currentTarget.dataset.text
    wx.setClipboardData({
      data: text,
      success() {
        wx.showToast({ title: '已复制', icon: 'success' })
      }
    })
  },

  // 删除单条收藏
  onRemove(e) {
    const hitokoto = e.currentTarget.dataset.hitokoto
    const app = getApp()

    wx.showModal({
      title: '提示',
      content: '确定取消收藏这条金句吗？',
      success: (res) => {
        if (res.confirm) {
          app.removeFavorite(hitokoto)
          this.setData({ favorites: app.globalData.favorites })
          wx.showToast({ title: '已取消收藏', icon: 'none' })
        }
      }
    })
  },

  // 清空全部
  onClearAll() {
    const app = getApp()
    wx.showModal({
      title: '提示',
      content: '确定清空所有收藏吗？此操作不可恢复。',
      success: (res) => {
        if (res.confirm) {
          app.globalData.favorites = []
          wx.setStorageSync('favorites', [])
          this.setData({ favorites: [] })
          wx.showToast({ title: '已清空', icon: 'success' })
        }
      }
    })
  },

  // 跳转首页
  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})
