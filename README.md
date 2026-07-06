# 天工小助手

微信小程序，集成每日一言、自选基金跟踪和 License 授权管理后台。

## 功能

### 每日一言
- 从 [一言 API](https://hitokoto.cn) 获取随机名言
- 收藏喜欢的金句（本地存储）
- 分享给朋友 / 朋友圈

### 理财（自选基金助手）
- 自选基金添加/删除，支持代码/名称/拼音搜索
- 实时估值查看（交易时段自动刷新）
- 持仓收益计算（金额 + 百分比，区分交易时段/收盘后）
- 手动编辑持仓（份额和成本价）
- 净值走势折线图（7天/1月/3月/6月/1年/3年/5年/全部）
- 基金板块标签显示
- 红涨绿跌中国市场配色
- 节假日智能判断
- 纯本地存储，无后端依赖

### License 管理后台
- 管理员登录
- 待审批请求（批准 / 拒绝）
- 授权码管理（查看 / 吊销）
- 激活日志
- 审批历史（筛选：全部 / 已批准 / 已拒绝 / 已过期）
- 离线激活（导入设备指纹 → 配置授权 → 生成授权文件）

## 技术栈

- 原生微信小程序（WXML + WXSS + JavaScript）
- 后端：[Licensing Server](https://github.com/MacTian/software-licensing-system)（ASP.NET Core + SQLite）

## 项目结构

```
├── app.js / app.json / app.wxss     # 全局配置
├── components/
│   └── quote-card/                   # 名言卡片组件
├── pages/
│   ├── index/                        # 首页（每日一言）
│   ├── favorites/                    # 收藏页
│   ├── privacy/                      # 隐私协议
│   ├── finance/                      # 理财
│   │   ├── index/                    # 理财主页（收益概览 + 基金列表）
│   │   ├── add/                      # 添加基金（搜索 + 添加）
│   │   ├── detail/                   # 持仓详情（净值走势 + 持仓信息）
│   │   └── edit/                     # 编辑持仓（份额 + 成本价）
│   └── admin/                        # License 管理
│       ├── index/                    # 管理首页（Dashboard）
│       ├── login/                    # 管理员登录
│       ├── requests/                 # 待审批请求
│       ├── licenses/                 # 授权码管理
│       ├── logs/                     # 激活日志
│       ├── history/                  # 审批历史
│       └── offline/                  # 离线激活
├── utils/
│   ├── request.js                    # 一言 API 封装
│   ├── license-api.js                # License API 封装
│   ├── fund-api.js                   # 基金 API 封装（东方财富）
│   ├── canvas-chart.js               # Canvas 折线图绘制
│   └── trade-date.js                 # 交易日判断
└── images/                           # Tab 栏图标
```

## 配置

### AppID
`wx96770931062908b2`

### 服务器域名（公众平台配置）
- request 合法域名：
  - `https://v1.hitokoto.cn`
  - `https://mylicense.up.railway.app`
  - `https://fundsuggest.eastmoney.com`
  - `https://fundgz.1234567.com.cn`
  - `https://fund.eastmoney.com`

> 理财功能以体验版部署，开发阶段在开发者工具中关闭域名校验（`urlCheck: false`）。

## License

MIT
