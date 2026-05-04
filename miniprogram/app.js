// miniprogram/app.js
App({
  onLaunch() {
    wx.cloud.init({
      env: 'your-env-id',  // 替换为实际云开发环境 ID
      traceUser: true
    });
  },

  globalData: {
    userInfo: null,
    syncStatus: null
  }
});
