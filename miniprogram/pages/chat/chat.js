// miniprogram/pages/chat/chat.js
const api = require('../../utils/api');
const storage = require('../../utils/storage');
const { generateId } = require('../../utils/format');

Page({
  data: {
    messages: [],
    inputText: '',
    loading: false,
    scrollToId: '',
    conversationId: null
  },

  onLoad(options) {
    const convId = options.id;
    this.data.conversationId = convId;

    const conv = storage.getConversation(convId);
    if (conv && conv.messages.length > 0) {
      this.setData({ messages: conv.messages });
      if (conv.messages.length === 1 && conv.messages[0].role === 'user') {
        this.doAsk(conv.messages[0].content);
      }
    }
  },

  onInputChange(e) {
    this.setData({ inputText: e.detail.value });
  },

  onSend() {
    const text = this.data.inputText.trim();
    if (!text || this.data.loading) return;

    const userMsg = {
      role: 'user',
      content: text,
      time: new Date().toISOString()
    };

    const messages = [...this.data.messages, userMsg];
    this.setData({
      messages,
      inputText: '',
      loading: true
    });

    this.saveMessages(messages);
    this.doAsk(text);
  },

  async doAsk(question) {
    const loadingMsg = { role: 'assistant', content: '', time: new Date().toISOString() };
    const messages = [...this.data.messages, loadingMsg];
    this.setData({ messages });

    try {
      const result = await api.askQuestion(question, this.data.conversationId);

      const aiMsg = {
        role: 'assistant',
        content: result.answer || '抱歉，我没有找到相关信息。',
        sources: result.sources || [],
        time: new Date().toISOString()
      };

      const finalMessages = [...this.data.messages, aiMsg];
      this.setData({
        messages: finalMessages,
        loading: false,
        scrollToId: `msg-${finalMessages.length - 1}`
      });

      this.saveMessages(finalMessages);
    } catch (e) {
      const errorMsg = {
        role: 'assistant',
        content: '请求失败，请稍后重试。',
        time: new Date().toISOString()
      };
      const finalMessages = [...this.data.messages, errorMsg];
      this.setData({ messages: finalMessages, loading: false });
      this.saveMessages(finalMessages);
    }
  },

  saveMessages(messages) {
    const conv = storage.getConversation(this.data.conversationId) || {
      id: this.data.conversationId,
      messages: [],
      createdAt: new Date().toISOString()
    };
    conv.messages = messages;
    conv.updatedAt = new Date().toISOString();
    storage.saveConversation(conv);
  },

  onFeedback(e) {
    const idx = e.currentTarget.dataset.index;
    const value = e.currentTarget.dataset.value;
    const key = `messages[${idx}].feedback`;
    this.setData({ [key]: value });
  },

  onSourceTap(e) {
    const url = e.currentTarget.dataset.url;
    if (url) {
      wx.setClipboardData({
        data: url,
        success() {
          wx.showToast({ title: '链接已复制', icon: 'success' });
        }
      });
    }
  }
});
