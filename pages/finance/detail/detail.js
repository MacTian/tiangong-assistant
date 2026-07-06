const { getFundData, getFundNavHistory, mergeFundData } = require('../../../utils/fund-api')
const { drawLineChart } = require('../../../utils/canvas-chart')

const HOLDINGS_KEY = 'finance_holdings'

Page({
  data: {
    loading: true,
    fund: null,
    chartDays: 7,
    chartData: []
  },

  onLoad(options) {
    this.code = options.code
  },

  onShow() {
    this.loadFund()
  },

  async loadFund() {
    const holdings = wx.getStorageSync(HOLDINGS_KEY) || []
    const holding = holdings.find(h => h.code === this.code)
    if (!holding) {
      wx.showToast({ title: '基金不存在', icon: 'none' })
      wx.navigateBack()
      return
    }

    this.setData({ loading: true })
    try {
      const apiData = await getFundData(this.code)
      if (apiData && apiData.length > 0) {
        const fund = mergeFundData(apiData[0], holding)
        this.setData({ fund, loading: false })
      }
    } catch (err) {
      console.error('加载基金详情失败:', err)
      this.setData({ loading: false })
    }

    this.loadChart()
  },

  async loadChart() {
    try {
      const data = await getFundNavHistory(this.code, this.data.chartDays)
      this.setData({ chartData: data })
      this.drawChart(data)
    } catch (err) {
      console.error('加载历史净值失败:', err)
    }
  },

  drawChart(rawData) {
    const data = rawData.map(item => ({ label: item.date, value: item.nav }))
    const query = wx.createSelectorQuery().in(this)
    query.select('#chart-canvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0]) return

      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = wx.getSystemInfoSync().pixelRatio
      const width = res[0].width
      const height = res[0].height

      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.scale(dpr, dpr)

      drawLineChart(ctx, canvas, data, {
        lineColor: '#3498db',
        pointColor: '#3498db',
        bgColor: '#ffffff',
        width,
        height,
        showLabels: true
      })
    })
  },

  onSwitchDays(e) {
    const days = parseInt(e.currentTarget.dataset.days)
    this.setData({ chartDays: days })
    this.loadChart()
  },

  goEdit() {
    const fund = this.data.fund
    const nav = fund.hasReplace ? fund.dwjz : fund.gsz
    wx.navigateTo({ url: `/pages/finance/edit/edit?code=${this.code}&nav=${nav}` })
  },

  onDelete() {
    const fund = this.data.fund
    wx.showModal({
      title: '提示',
      content: `确定删除${fund.name}？删除后持仓数据将丢失`,
      success: (res) => {
        if (res.confirm) {
          const holdings = wx.getStorageSync(HOLDINGS_KEY) || []
          const filtered = holdings.filter(h => h.code !== this.code)
          wx.setStorageSync(HOLDINGS_KEY, filtered)
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        }
      }
    })
  }
})
