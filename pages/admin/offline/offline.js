const licenseApi = require('../../../utils/license-api')

Page({
  data: {
    step: 1,
    fileName: '',
    fingerprint: null,
    licenseType: 0,
    durationDays: 30,
    maxActivations: 1,
    offlineGraceDays: 7,
    notes: '',
    activating: false,
    licenseResult: null,
    licenseFileBase64: '',
    licenseFileName: '',
    errorMsg: '',
    durationOptions: [
      { label: '1天', value: 1 },
      { label: '7天', value: 7 },
      { label: '30天', value: 30 },
      { label: '90天', value: 90 },
      { label: '365天', value: 365 }
    ]
  },

  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['.json'],
      success: (res) => {
        const file = res.tempFiles[0]
        const fs = wx.getFileSystemManager()
        fs.readFile({
          filePath: file.path,
          encoding: 'utf8',
          success: (readRes) => {
            try {
              const data = JSON.parse(readRes.data)
              if (data.deviceFingerprint) {
                this.setData({
                  fileName: file.name,
                  fingerprint: {
                    deviceFingerprint: data.deviceFingerprint,
                    deviceInfo: data.deviceInfo || '',
                    softwareId: data.softwareId || ''
                  }
                })
              } else {
                wx.showToast({ title: '无效的指纹文件', icon: 'none' })
              }
            } catch (e) {
              wx.showToast({ title: '文件格式错误', icon: 'none' })
            }
          }
        })
      }
    })
  },

  nextStep() {
    if (this.data.step < 3) {
      this.setData({ step: this.data.step + 1 })
    }
  },

  prevStep() {
    if (this.data.step > 1) {
      this.setData({ step: this.data.step - 1 })
    }
  },

  setType(e) {
    this.setData({ licenseType: parseInt(e.currentTarget.dataset.type) })
  },

  setDuration(e) {
    this.setData({ durationDays: parseInt(e.currentTarget.dataset.days) })
  },

  setMaxAct(e) {
    this.setData({ maxActivations: parseInt(e.detail.value) || 1 })
  },

  setGraceDays(e) {
    this.setData({ offlineGraceDays: parseInt(e.detail.value) || 7 })
  },

  setNotes(e) {
    this.setData({ notes: e.detail.value })
  },

  async doOfflineActivate() {
    const { fingerprint, licenseType, durationDays, maxActivations, offlineGraceDays, notes } = this.data
    if (!fingerprint) return

    this.setData({ activating: true })
    try {
      const res = await licenseApi.offlineActivate({
        DeviceFingerprint: fingerprint.deviceFingerprint,
        DeviceInfo: fingerprint.deviceInfo,
        SoftwareId: fingerprint.softwareId,
        LicenseType: licenseType,
        DurationDays: licenseType === 0 ? durationDays : null,
        MaxActivations: maxActivations,
        OfflineGraceDays: offlineGraceDays,
        Notes: notes
      })

      console.log('offlineActivate response:', JSON.stringify(res).substring(0, 500))
      if (res.success !== false) {
        const result = res.data || res
        console.log('result keys:', Object.keys(result))
        console.log('licenseFileBase64:', result.licenseFileBase64 ? result.licenseFileBase64.substring(0, 50) : 'EMPTY')
        const code = result.licenseCode || 'offline'
        this.setData({
          step: 3,
          licenseResult: {
            licenseCode: code,
            type: result.type || licenseType,
            expiresAt: result.expiresAt,
            expiresAtFormatted: result.expiresAt ? this.formatTime(result.expiresAt) : ''
          },
          licenseFileBase64: result.licenseFileBase64 || result.LicenseFileBase64 || result.licenseFile || '',
          licenseFileName: `license-${code}.json`
        })
      } else {
        this.setData({ step: 3, errorMsg: res.message || '生成失败' })
      }
    } catch (err) {
      this.setData({ step: 3, errorMsg: err.message || '网络错误' })
    } finally {
      this.setData({ activating: false })
    }
  },

  formatTime(str) {
    if (!str) return ''
    const d = new Date(str)
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  },

  downloadLicenseFile() {
    const { licenseFileBase64, licenseResult } = this.data
    console.log('downloadLicenseFile called, licenseFileBase64 length:', licenseFileBase64 ? licenseFileBase64.length : 0)
    if (!licenseFileBase64) {
      wx.showToast({ title: '无授权文件数据', icon: 'none' })
      return
    }

    const code = licenseResult.licenseCode || 'offline'
    const fileName = `license-${code}.json`
    const fs = wx.getFileSystemManager()
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`

    try {
      // base64 解码写入文件
      fs.writeFile({
        filePath,
        data: licenseFileBase64,
        encoding: 'base64',
        success: () => {
          wx.shareFileToMessage({
            filePath,
            success: () => {
              wx.showToast({ title: '文件已发送', icon: 'success' })
            },
            fail: (err) => {
              if (err.errMsg && err.errMsg.indexOf('cancel') === -1) {
                wx.showToast({ title: '发送失败', icon: 'none' })
              }
            }
          })
        },
        fail: () => {
          wx.showToast({ title: '文件写入失败', icon: 'none' })
        }
      })
    } catch (e) {
      wx.showToast({ title: '文件处理失败', icon: 'none' })
    }
  },

  reset() {
    this.setData({
      step: 1,
      fileName: '',
      fingerprint: null,
      licenseType: 0,
      durationDays: 30,
      maxActivations: 1,
      offlineGraceDays: 7,
      notes: '',
      licenseResult: null,
      licenseFileBase64: '',
      licenseFileName: '',
      errorMsg: ''
    })
  }
})
