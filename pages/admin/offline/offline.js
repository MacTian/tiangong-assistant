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

      if (res.success !== false) {
        const result = res.data || res
        this.setData({
          step: 3,
          licenseResult: {
            licenseCode: result.licenseCode,
            type: result.type || licenseType,
            expiresAt: result.expiresAt,
            expiresAtFormatted: result.expiresAt ? this.formatTime(result.expiresAt) : ''
          },
          licenseFileBase64: result.licenseFileBase64 || result.licenseFile || ''
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

  copyLicenseFile() {
    wx.setClipboardData({
      data: this.data.licenseFileBase64,
      success() {
        wx.showToast({ title: '已复制', icon: 'success' })
      }
    })
  },

  onShareAppMessage() {
    return {
      title: '离线授权文件',
      path: '/pages/admin/offline/offline'
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
      errorMsg: ''
    })
  }
})
