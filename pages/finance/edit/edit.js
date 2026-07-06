const HOLDINGS_KEY = 'finance_holdings'

Page({
  data: {
    code: '',
    name: '',
    currentNav: 0,
    num: '',
    cost: '',
    previewGains: '--',
    previewRate: '--'
  },

  onLoad(options) {
    this.code = options.code
    const currentNav = parseFloat(options.nav) || 0
    const holdings = wx.getStorageSync(HOLDINGS_KEY) || []
    const holding = holdings.find(h => h.code === this.code)

    if (holding) {
      this.setData({
        code: holding.code,
        name: holding.name,
        currentNav,
        num: holding.num > 0 ? String(holding.num) : '',
        cost: holding.cost > 0 ? String(holding.cost) : ''
      })
    }
  },

  onInputNum(e) {
    let val = e.detail.value
    val = val.replace(/[^0-9.]/g, '')
    const parts = val.split('.')
    if (parts.length > 2) val = parts[0] + '.' + parts[1]
    if (parts[1] && parts[1].length > 2) val = parts[0] + '.' + parts[1].substr(0, 2)
    if (parseFloat(val) > 9999999) val = '9999999'

    this.setData({ num: val })
    this.calcPreview()
  },

  onInputCost(e) {
    let val = e.detail.value
    val = val.replace(/[^0-9.]/g, '')
    const parts = val.split('.')
    if (parts.length > 2) val = parts[0] + '.' + parts[1]
    if (parts[1] && parts[1].length > 4) val = parts[0] + '.' + parts[1].substr(0, 4)
    if (parseFloat(val) > 9999) val = '9999'

    this.setData({ cost: val })
    this.calcPreview()
  },

  calcPreview() {
    const num = parseFloat(this.data.num) || 0
    const cost = parseFloat(this.data.cost) || 0
    const nav = this.data.currentNav || 0

    if (cost > 0 && nav > 0) {
      const gains = Number(((nav - cost) * num).toFixed(2))
      const rate = Number(((nav - cost) / cost * 100).toFixed(2))
      this.setData({
        previewGains: String(gains),
        previewRate: String(rate) + '%'
      })
    } else {
      this.setData({ previewGains: '--', previewRate: '--' })
    }
  },

  onSave() {
    const num = parseFloat(this.data.num) || 0
    const cost = parseFloat(this.data.cost) || 0

    const holdings = wx.getStorageSync(HOLDINGS_KEY) || []
    const index = holdings.findIndex(h => h.code === this.code)

    if (index >= 0) {
      holdings[index].num = num
      holdings[index].cost = cost
    }

    wx.setStorageSync(HOLDINGS_KEY, holdings)
    wx.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 1500)
  }
})
