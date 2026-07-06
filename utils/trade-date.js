// utils/trade-date.js
// 交易日判断（holiday.json + 精确时段判断）

const HOLIDAY_URL = 'https://x2rr.github.io/funds/holiday.json'
const HOLIDAY_KEY = 'finance_holiday'
const HOLIDAY_CACHE_DAYS = 30

let holidayData = null

/**
 * 加载节假日数据
 * 缓存策略：30天过期重新拉取，网络失败降级为周一至周五判断
 */
async function loadHoliday() {
  const cached = wx.getStorageSync(HOLIDAY_KEY)
  if (cached && cached.data && cached.timestamp) {
    const age = Date.now() - cached.timestamp
    if (age < HOLIDAY_CACHE_DAYS * 24 * 60 * 60 * 1000) {
      holidayData = cached.data
      return
    }
  }

  try {
    const data = await new Promise((resolve, reject) => {
      wx.request({
        url: HOLIDAY_URL,
        success(res) {
          if (res.statusCode === 200 && res.data) {
            resolve(res.data)
          } else {
            reject(new Error('节假日数据请求失败'))
          }
        },
        fail(err) {
          reject(err)
        }
      })
    })
    holidayData = data
    wx.setStorageSync(HOLIDAY_KEY, {
      data: data,
      timestamp: Date.now()
    })
  } catch (err) {
    console.error('加载节假日数据失败，使用降级策略:', err)
  }
}

function isHoliday(dateStr) {
  if (!holidayData) return false
  const year = dateStr.substr(0, 4)
  const yearData = holidayData[year]
  if (!yearData) return false
  return yearData.holiday && yearData.holiday.includes(dateStr)
}

function isWeekend(date) {
  const day = date.getDay()
  return day === 0 || day === 6
}

/**
 * 判断指定日期是否为交易日（不含时段判断）
 * @param {Date} date 默认当前时间
 * @returns {boolean}
 */
function isTradeDay(date) {
  date = date || new Date()
  const utc = date.getTime() + date.getTimezoneOffset() * 60 * 1000
  const cnDate = new Date(utc + 8 * 60 * 60 * 1000)
  const dateStr = `${cnDate.getFullYear()}-${String(cnDate.getMonth() + 1).padStart(2, '0')}-${String(cnDate.getDate()).padStart(2, '0')}`

  if (isHoliday(dateStr)) return false
  if (isWeekend(cnDate)) return false
  return true
}

/**
 * 判断当前是否为交易时段（精确到分钟）
 * 交易时段：工作日 9:30-11:35, 13:00-15:05（排除节假日）
 * 时区：东八区（UTC+8）
 * @returns {boolean}
 */
function isDuringTrading() {
  const now = new Date()
  if (!isTradeDay(now)) return false

  const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000
  const cnNow = new Date(utc + 8 * 60 * 60 * 1000)
  const hours = cnNow.getHours()
  const minutes = cnNow.getMinutes()
  const time = hours * 60 + minutes

  // 9:30 (570) ~ 11:35 (695)
  if (time >= 570 && time <= 695) return true
  // 13:00 (780) ~ 15:05 (905)
  if (time >= 780 && time <= 905) return true

  return false
}

module.exports = {
  loadHoliday,
  isTradeDay,
  isDuringTrading
}
