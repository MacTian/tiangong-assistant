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
    licenseFileContent: '',
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
        const code = result.licenseCode || 'offline'
        const base64 = result.licenseFileBase64 || result.LicenseFileBase64 || result.licenseFile || ''

        // 预解码 JSON 内容用于显示
        let fileContent = ''
        if (base64) {
          try {
            const bytes = wx.base64ToArrayBuffer(base64)
            const jsonStr = String.fromCharCode.apply(null, new Uint8Array(bytes))
            fileContent = JSON.stringify(JSON.parse(jsonStr), null, 2)
          } catch (e) {
            fileContent = '(解码失败)'
          }
        }

        this.setData({
          step: 3,
          licenseResult: {
            licenseCode: code,
            type: result.type || licenseType,
            expiresAt: result.expiresAt,
            expiresAtFormatted: result.expiresAt ? this.formatTime(result.expiresAt) : ''
          },
          licenseFileBase64: base64,
          licenseFileName: `license-${code}.json`,
          licenseFileContent: fileContent
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
    if (!licenseFileBase64) {
      wx.showToast({ title: '无授权文件数据', icon: 'none' })
      return
    }

    const code = licenseResult.licenseCode || 'offline'

    try {
      // base64 解码为 JSON 字符串
      const bytes = wx.base64ToArrayBuffer(licenseFileBase64)
      const jsonStr = String.fromCharCode.apply(null, new Uint8Array(bytes))

      // 格式化 JSON
      let prettyJson
      try {
        prettyJson = JSON.stringify(JSON.parse(jsonStr), null, 2)
      } catch (e) {
        prettyJson = jsonStr
      }

      this.setData({ licenseFileContent: prettyJson })

      wx.setClipboardData({
        data: prettyJson,
        success() {
          wx.showModal({
            title: '已复制到剪贴板',
            content: `文件名: license-${code}.json\n\n请新建文件粘贴内容并保存为 .json 文件，即可导入客户端激活。`,
            showCancel: false,
            confirmText: '知道了'
          })
        }
      })
    } catch (e) {
      console.log('decode error:', e)
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
      licenseFileContent: '',
      errorMsg: ''
    })
  }
})
