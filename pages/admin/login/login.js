const licenseApi = require('../../../utils/license-api')

Page({
  data: {
    username: '',
    password: '',
    loading: false,
    error: ''
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value, error: '' })
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value, error: '' })
  },

  async onLogin() {
    const { username, password } = this.data
    if (!username || !password) {
      this.setData({ error: '请输入用户名和密码' })
      return
    }

    this.setData({ loading: true, error: '' })
    try {
      const res = await licenseApi.login(username, password)
      // 服务器返回格式: { success: true, data: { token: "xxx", username: "admin" } }
      if (res.success && res.data && res.data.token) {
        licenseApi.setToken(res.data.token)
        wx.showToast({ title: '登录成功', icon: 'success' })
        setTimeout(() => {
          wx.navigateBack()
        }, 800)
      } else {
        this.setData({ error: res.message || '登录失败' })
      }
    } catch (err) {
      this.setData({ error: err.message || '网络错误' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
