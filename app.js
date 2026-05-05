App({
  globalData: {
    favorites: []
  },

  onLaunch() {
    // 检查隐私协议
    const privacyAgreed = wx.getStorageSync('privacyAgreed')
    if (!privacyAgreed) {
      wx.reLaunch({
        url: '/pages/privacy/privacy'
      })
      return
    }

    // 从本地存储加载收藏列表
    const favorites = wx.getStorageSync('favorites') || []
    this.globalData.favorites = favorites
  },

  // 添加收藏
  addFavorite(quote) {
    const favorites = this.globalData.favorites
    // 检查是否已收藏
    const exists = favorites.some(item => item.hitokoto === quote.hitokoto)
    if (!exists) {
      const newItem = { ...quote, savedAt: Date.now() }
      favorites.unshift(newItem)
      this.globalData.favorites = favorites
      wx.setStorageSync('favorites', favorites)
      return true
    }
    return false
  },

  // 取消收藏
  removeFavorite(hitokoto) {
    const favorites = this.globalData.favorites.filter(
      item => item.hitokoto !== hitokoto
    )
    this.globalData.favorites = favorites
    wx.setStorageSync('favorites', favorites)
  },

  // 检查是否已收藏
  isFavorite(hitokoto) {
    return this.globalData.favorites.some(item => item.hitokoto === hitokoto)
  }
})
