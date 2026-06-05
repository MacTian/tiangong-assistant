const { getQuote } = require('../../utils/request')

Page({
  data: {
    loading: true,
    error: '',
    quote: {}
  },

  onLoad() {
    this.fetchQuote()
  },

  // 获取一言
  async fetchQuote() {
    this.setData({ loading: true, error: '' })
    try {
      const data = await getQuote()
      this.setData({
        quote: data,
        loading: false
      })
    } catch (err) {
      this.setData({
        loading: false,
        error: '网络不给力，请稍后再试'
      })
    }
  },

  // 收藏 / 取消收藏
  onFavorite() {
    const app = getApp()
    const { quote } = this.data
    const isFavorited = app.isFavorite(quote.hitokoto)

    if (isFavorited) {
      app.removeFavorite(quote.hitokoto)
      wx.showToast({ title: '已取消收藏', icon: 'none' })
    } else {
      app.addFavorite(quote)
      wx.showToast({ title: '收藏成功', icon: 'success' })
    }

    // 触发组件刷新收藏状态
    this.setData({ quote: { ...quote } })
  },

  // 分享
  onShare() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  },

  // 分享给朋友
  onShareAppMessage() {
    const text = this.data.quote.hitokoto || '每日一言，启迪心智'
    return {
      title: `「${text.substring(0, 20)}${text.length > 20 ? '...' : ''}」— 天工小助手`,
      path: '/pages/index/index',
      imageUrl: ''
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    const text = this.data.quote.hitokoto || '每日一言，启迪心智'
    return {
      title: `「${text}」— 天工小助手`,
      query: ''
    }
  }
})
