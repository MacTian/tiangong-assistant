const { getFundData, mergeFundData } = require('../../../utils/fund-api')
const { loadHoliday, isDuringTrading } = require('../../../utils/trade-date')

const HOLDINGS_KEY = 'finance_holdings'

Page({
  data: {
    loading: true,
    list: [],
    summary: {
      totalAmount: '--',
      totalGains: '--',
      totalGainsRate: '--',
      todayGains: '--',
      todayGainsRate: '--',
      fundCount: 0
    },
    trading: false,
    autoRefresh: true,
    showAmount: true,
    sortAsc: true,
    lastUpdate: '',
    timer: null
  },

  async onShow() {
    this.loadHoldings()
    await loadHoliday()
    this.setData({ trading: isDuringTrading() })
    this.refreshData()
    this.startAutoRefresh()
  },

  onHide() {
    this.stopAutoRefresh()
  },

  onUnload() {
    this.stopAutoRefresh()
  },

  onPullDownRefresh() {
    this.refreshData().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  loadHoldings() {
    const holdings = wx.getStorageSync(HOLDINGS_KEY) || []
    this.setData({ holdings })
  },

  async refreshData() {
    const { holdings } = this.data
    if (!holdings || holdings.length === 0) {
      this.setData({
        loading: false,
        list: [],
        summary: { totalAmount: '--', totalGains: '--', totalGainsRate: '--', todayGains: '--', todayGainsRate: '--', fundCount: 0 }
      })
      return
    }

    this.setData({ loading: true })
    try {
      const codes = holdings.map(h => h.code).join(',')
      const apiData = await getFundData(codes)

      const list = holdings.map(holding => {
        const apiItem = apiData.find(d => d.fundcode === holding.code)
        if (apiItem) {
          return { ...mergeFundData(apiItem, holding), sectors: holding.sectors || [] }
        }
        return {
          fundcode: holding.code,
          name: holding.name,
          dwjz: 0, gsz: 0, gszzl: 0,
          jzrq: '', gztime: '', hasReplace: false,
          num: holding.num, cost: holding.cost,
          amount: 0, gains: 0, costGains: 0, costGainsRate: 0,
          sectors: holding.sectors || []
        }
      })

      // 按今日预估收益百分比排序
      const sortAsc = this.data.sortAsc
      list.sort((a, b) => sortAsc ? (a.gszzl || 0) - (b.gszzl || 0) : (b.gszzl || 0) - (a.gszzl || 0))

      // 取最新估值时间
      const updateTime = list.find(item => item.gztime)
      this.setData({
        list,
        loading: false,
        trading: isDuringTrading(),
        lastUpdate: updateTime ? updateTime.gztime : ''
      })
      this.calcSummary(list)
    } catch (err) {
      console.error('刷新基金数据失败:', err)
      // API 失败时仍显示基金列表（无行情数据）
      const list = holdings.map(holding => ({
        fundcode: holding.code,
        name: holding.name,
        dwjz: 0, gsz: 0, gszzl: 0,
        jzrq: '', gztime: '', hasReplace: false,
        num: holding.num, cost: holding.cost,
        amount: 0, gains: 0, costGains: 0, costGainsRate: 0,
        sectors: holding.sectors || []
      }))
      this.setData({ list, loading: false })
      wx.showToast({ title: '行情获取失败，显示本地数据', icon: 'none' })
    }
  },

  calcSummary(list) {
    let totalAmount = 0
    let totalCost = 0
    let totalGains = 0
    let todayGains = 0
    let count = 0

    list.forEach(item => {
      if (item.amount > 0) {
        totalAmount += item.amount
        totalCost += item.cost * item.num
        totalGains += item.costGains
        todayGains += item.gains
        count++
      }
    })

    const totalGainsRate = totalCost > 0 ? Number((totalGains / totalCost * 100).toFixed(2)) : 0
    const todayBase = totalAmount - todayGains
    const todayGainsRate = todayBase > 0 ? Number((todayGains / todayBase * 100).toFixed(2)) : 0

    this.setData({
      summary: {
        totalAmount: count > 0 ? totalAmount.toFixed(2) : '--',
        totalGains: count > 0 ? totalGains.toFixed(2) : '--',
        totalGainsRate: count > 0 ? totalGainsRate.toFixed(2) : '--',
        todayGains: count > 0 ? todayGains.toFixed(2) : '--',
        todayGainsRate: count > 0 ? todayGainsRate.toFixed(2) : '--',
        fundCount: list.length
      }
    })
  },

  onToggleAmount() {
    this.setData({ showAmount: !this.data.showAmount })
  },

  onToggleSort() {
    const sortAsc = !this.data.sortAsc
    const list = this.data.list.slice().sort((a, b) => sortAsc ? (a.gszzl || 0) - (b.gszzl || 0) : (b.gszzl || 0) - (a.gszzl || 0))
    this.setData({ sortAsc, list })
  },

  startAutoRefresh() {
    this.stopAutoRefresh()
    if (!this.data.autoRefresh) return
    if (!isDuringTrading()) return

    const timer = setInterval(() => {
      this.refreshData()
    }, 60000)
    this.setData({ timer })
  },

  stopAutoRefresh() {
    if (this.data.timer) {
      clearInterval(this.data.timer)
      this.setData({ timer: null })
    }
  },

  onToggleRefresh() {
    const autoRefresh = !this.data.autoRefresh
    this.setData({ autoRefresh })
    if (autoRefresh) {
      this.startAutoRefresh()
      wx.showToast({ title: '已开启自动刷新', icon: 'none' })
    } else {
      this.stopAutoRefresh()
      wx.showToast({ title: '已暂停自动刷新', icon: 'none' })
    }
  },

  onTapFund(e) {
    const code = e.currentTarget.dataset.code
    wx.navigateTo({ url: `/pages/finance/detail/detail?code=${encodeURIComponent(code)}` })
  },

  onLongPressFund(e) {
    const { code, name } = e.currentTarget.dataset
    wx.showModal({
      title: '提示',
      content: `确定删除${name}？删除后持仓数据将丢失`,
      success: (res) => {
        if (res.confirm) {
          this.deleteFund(code)
        }
      }
    })
  },

  deleteFund(code) {
    const holdings = (this.data.holdings || []).filter(h => h.code !== code)
    wx.setStorageSync(HOLDINGS_KEY, holdings)
    this.setData({ holdings })
    this.refreshData()
    wx.showToast({ title: '已删除', icon: 'success' })
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/finance/add/add' })
  }
})
