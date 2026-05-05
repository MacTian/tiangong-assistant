Page({
  onAgree() {
    wx.setStorageSync('privacyAgreed', true)
    wx.reLaunch({
      url: '/pages/index/index'
    })
  }
})
