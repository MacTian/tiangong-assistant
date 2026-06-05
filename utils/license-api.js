// License Server API 封装
const BASE_URL = 'https://mylicense.up.railway.app'

function getToken() {
  return wx.getStorageSync('admin_token') || ''
}

function setToken(token) {
  wx.setStorageSync('admin_token', token)
}

function clearToken() {
  wx.removeStorageSync('admin_token')
}

function isLoggedIn() {
  return !!getToken()
}

// 统一请求
function request(options) {
  return new Promise((resolve, reject) => {
    const token = getToken()
    const header = {
      'Content-Type': 'application/json'
    }
    // 携带认证 Cookie
    if (token) {
      header['Cookie'] = 'auth_token=' + token
    }

    wx.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: header,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else if (res.statusCode === 401) {
          clearToken()
          reject(new Error('登录已过期，请重新登录'))
        } else {
          reject(new Error(res.data?.message || '请求失败: ' + res.statusCode))
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络错误'))
      }
    })
  })
}

// 管理员登录（登录接口不需要 token）
function login(username, password) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + '/api/admin/login',
      method: 'POST',
      data: { Username: username, Password: password },
      header: { 'Content-Type': 'application/json' },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else {
          reject(new Error(res.data?.message || '登录失败: ' + res.statusCode))
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络错误'))
      }
    })
  })
}

// 待审批请求
function getRequests() {
  return request({ url: '/api/admin/requests' })
}

// 批准请求
function approveRequest(data) {
  return request({
    url: '/api/admin/approve',
    method: 'POST',
    data
  })
}

// 拒绝请求
function rejectRequest(requestCode) {
  return request({
    url: '/api/admin/reject',
    method: 'POST',
    data: { RequestCode: requestCode }
  })
}

// 授权码列表
function getLicenses() {
  return request({ url: '/api/admin/licenses' })
}

// 吊销授权
function revokeLicense(code) {
  return request({
    url: '/api/admin/revoke',
    method: 'POST',
    data: { Code: code }
  })
}

// 激活日志
function getLogs() {
  return request({ url: '/api/admin/logs' })
}

// 审批历史
function getHistory() {
  return request({ url: '/api/admin/history' })
}

// 离线激活
function offlineActivate(fingerprintData) {
  return request({
    url: '/api/admin/offline-activate',
    method: 'POST',
    data: fingerprintData
  })
}

// 验证授权文件
function verifyLicenseFile(licenseFileBase64) {
  return request({
    url: '/api/admin/verify-license-file',
    method: 'POST',
    data: { LicenseFileBase64: licenseFileBase64 }
  })
}

module.exports = {
  BASE_URL,
  getToken,
  setToken,
  clearToken,
  isLoggedIn,
  login,
  getRequests,
  approveRequest,
  rejectRequest,
  getLicenses,
  revokeLicense,
  getLogs,
  getHistory,
  offlineActivate,
  verifyLicenseFile
}
