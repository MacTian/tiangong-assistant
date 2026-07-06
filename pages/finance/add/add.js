const { searchFund } = require('../../../utils/fund-api')

const HOLDINGS_KEY = 'finance_holdings'
let searchTimer = null

Page({
  data: {
    keyword: '',
    searching: false,
    searchResult: [],
    holdings: []
  },

  onLoad() {
    this.setData({ holdings: wx.getStorageSync(HOLDINGS_KEY) || [] })
  },

  onInput(e) {
    const keyword = e.detail.value.trim()
    this.setData({ keyword })

    if (searchTimer) clearTimeout(searchTimer)

    if (keyword.length === 0) {
      this.setData({ searchResult: [], searching: false })
      return
    }

    searchTimer = setTimeout(() => {
      this.doSearch(keyword)
    }, 300)
  },

  async doSearch(keyword) {
    this.setData({ searching: true })
    try {
      const result = await searchFund(keyword)
      const holdings = this.data.holdings
      const list = result.map(item => ({
        ...item,
        added: holdings.some(h => h.code === item.code)
      }))
      this.setData({ searchResult: list, searching: false })
    } catch (err) {
      this.setData({ searching: false })
      wx.showToast({ title: '搜索失败，请重试', icon: 'none' })
    }
  },

  onAdd(e) {
    const { code, name } = e.currentTarget.dataset
    const holdings = this.data.holdings

    if (holdings.some(h => h.code === code)) {
      wx.showToast({ title: '已添加', icon: 'none' })
      return
    }

    // 从搜索结果中获取板块信息
    const searchItem = this.data.searchResult.find(item => item.code === code)
    const sectors = (searchItem && searchItem.sectors) || []

    holdings.push({ code, name, num: 0, cost: 0, sectors })
    wx.setStorageSync(HOLDINGS_KEY, holdings)
    this.setData({ holdings })

    const searchResult = this.data.searchResult.map(item => ({
      ...item,
      added: item.code === code ? true : item.added
    }))
    this.setData({ searchResult })

    wx.showToast({ title: '添加成功', icon: 'success' })
  }
})
