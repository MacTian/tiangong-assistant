Component({
  properties: {
    content: {
      type: String,
      value: ''
    },
    author: {
      type: String,
      value: ''
    },
    from: {
      type: String,
      value: ''
    },
    showActions: {
      type: Boolean,
      value: true
    }
  },

  data: {
    isFavorited: false
  },

  observers: {
    'content': function (content) {
      if (content) {
        const app = getApp()
        this.setData({
          isFavorited: app.isFavorite(content)
        })
      }
    }
  },

  methods: {
    onRefresh() {
      this.triggerEvent('refresh')
    },

    onFavorite() {
      this.triggerEvent('favorite')
    },

    onShare() {
      this.triggerEvent('share')
    }
  }
})
