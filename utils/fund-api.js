// utils/fund-api.js
// 东方财富基金 API 封装

/**
 * 获取单只基金估值数据
 * @param {string} fundCode 基金代码
 * @returns {Promise<Object>} 基金数据
 */
function fetchSingleFund(fundCode) {
  return new Promise((resolve) => {
    wx.request({
      url: `https://fundgz.1234567.com.cn/js/${fundCode}.js?rt=${Date.now()}`,
      success(res) {
        if (res.statusCode === 200 && res.data) {
          resolve(res.data)
        } else {
          resolve(null)
        }
      },
      fail() {
        resolve(null)
      }
    })
  })
}

/**
 * 批量获取基金估值数据
 * @param {string} fundCodes 逗号分隔的基金代码，如 "001618,003834"
 * @returns {Promise<Array>} 基金数据数组
 */
function getFundData(fundCodes) {
  const codes = fundCodes.split(',').filter(c => c.trim())
  return Promise.all(codes.map(code => fetchSingleFund(code.trim()))).then(results => {
    return results.filter(r => r !== null)
  })
}

/**
 * 搜索基金
 * @param {string} keyword 关键词（代码/名称/拼音）
 * @returns {Promise<Array>} 搜索结果 [{code, name, type, sectors}]
 */
function searchFund(keyword) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: 'https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx',
      data: {
        m: 9,
        key: keyword,
        _: Date.now()
      },
      success(res) {
        if (res.statusCode === 200 && res.data && res.data.Datas) {
          const list = res.data.Datas.map(item => ({
            code: item.CODE,
            name: item.NAME,
            type: item.FundBaseInfo ? item.FundBaseInfo.FTYPE : '',
            sectors: (item.ZTJJInfo || []).map(s => s.TTYPENAME).filter(Boolean)
          }))
          resolve(list)
        } else {
          resolve([])
        }
      },
      fail() {
        reject(new Error('搜索失败'))
      }
    })
  })
}

/**
 * 获取基金历史净值
 * @param {string} fundCode 基金代码
 * @param {number} days 天数
 * @returns {Promise<Array>} [{date, nav}]
 */
function getFundNavHistory(fundCode, days) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `https://fund.eastmoney.com/pingzhongdata/${fundCode}.js`,
      dataType: 'text',
      success(res) {
        if (res.statusCode === 200 && res.data) {
          try {
            const text = typeof res.data === 'string' ? res.data : ''
            const match = text.match(/Data_netWorthTrend\s*=\s*(\[.*?\]);/s)
            if (match) {
              const data = JSON.parse(match[1])
              const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
              const filtered = data
                .filter(item => item.x >= cutoff)
                .map(item => ({
                  date: formatDate(item.x),
                  nav: item.y
                }))
              resolve(filtered)
            } else {
              resolve([])
            }
          } catch (e) {
            resolve([])
          }
        } else {
          resolve([])
        }
      },
      fail() {
        reject(new Error('历史净值请求失败'))
      }
    })
  })
}

/**
 * 将 API 返回的基金数据转换为运行时格式
 * @param {Object} apiItem API 返回的单条数据（fundgz 接口格式）
 * @param {Object} holding 持仓数据 {code, name, num, cost}
 * @returns {Object} 运行时数据
 */
function mergeFundData(apiItem, holding) {
  const dwjz = parseFloat(apiItem.dwjz) || 0
  const gsz = parseFloat(apiItem.gsz) || 0
  const gszzl = parseFloat(apiItem.gszzl) || 0
  const num = holding.num || 0
  const cost = holding.cost || 0
  const hasReplace = apiItem.jzrq && apiItem.gztime &&
    apiItem.jzrq === apiItem.gztime.substr(0, 10)

  const currentNav = hasReplace ? dwjz : (gsz || dwjz)
  const amount = Number((dwjz * num).toFixed(2))
  const costGains = cost > 0 ? Number(((currentNav - cost) * num).toFixed(2)) : 0
  const costGainsRate = cost > 0 ? Number(((currentNav - cost) / cost * 100).toFixed(2)) : 0

  let gains = 0
  if (hasReplace) {
    if (gszzl !== -100 && gszzl !== 0) {
      const yesterdayNav = dwjz / (1 + gszzl * 0.01)
      gains = Number(((dwjz - yesterdayNav) * num).toFixed(2))
    }
  } else {
    gains = Number(((gsz - dwjz) * num).toFixed(2))
  }

  return {
    fundcode: apiItem.fundcode || holding.code,
    name: apiItem.name || holding.name,
    dwjz,
    gsz: hasReplace ? dwjz : gsz,
    gszzl: hasReplace ? gszzl : gszzl,
    jzrq: apiItem.jzrq || '',
    gztime: apiItem.gztime || '',
    hasReplace,
    num,
    cost,
    amount,
    gains,
    costGains,
    costGainsRate
  }
}

function formatDate(timestamp) {
  const d = new Date(timestamp)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}-${day}`
}

module.exports = {
  getFundData,
  searchFund,
  getFundNavHistory,
  mergeFundData
}
