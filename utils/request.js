// 封装网络请求
function request(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json'
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else {
          reject(new Error(`请求失败: ${res.statusCode}`))
        }
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

// 获取一言
function getQuote() {
  return request({
    url: 'https://v1.hitokoto.cn/?c=i&c=d&c=k&encode=json'
  })
}

module.exports = { request, getQuote }
