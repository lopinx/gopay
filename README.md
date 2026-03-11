# GoPay

一个兼容易支付（epay）协议的 Node.js 聚合支付系统，支持支付宝、微信支付和 PayPal。

> 初衷：易支付代码业务逻辑不严谨，经常掉单。替换成 GoPay 后基本 0 掉单！

## 特性

- ✅ 兼容易支付协议，源站无需改动
- ✅ 支付宝：PC 网站支付、手机网站支付
- ✅ 微信支付：H5 支付、Native 扫码
- ✅ PayPal：PayPal 支付
- ✅ 多通道负载均衡
- ✅ UA 自动识别终端类型
- ✅ 订单自动重写（防风控）
- ✅ 启动校验：仅启用配置完整的通道
- ✅ 数据库：SQLite（默认）/ MySQL / PostgreSQL

## 快速开始

```bash
# 安装依赖
npm install

# 启动服务
node app.js

# 生产环境（守护进程）
pm2 start app.js --name=gopay
```

服务默认监听 `127.0.0.1:3000`

## 配置

编辑 `config.js`：

```javascript
module.exports = {
    web: {
        payUrl: 'https://pay.xxxx.com'  // 支付域名，用于回调通知
    },
    user: {
        '10001': { key: '你的商户KEY' }
    },
    alipay: [
        { appId: '', privateKey: '', alipayPublicKey: '' }
    ],
    wxpay: [
        { appId: '', mchid: '', privateKey: Buffer, serial: '', secret: '', certs: {}, only_native: false }
    ],
    paypal: [
        { clientId: '', secret: '', mode: 'sandbox' }  // sandbox 或 live
    ],
    form: {
        subject: { rewrite: true, text: ['商品A', '商品B'] },
        body: { rewrite: true, text: '商品描述' }
    },
db: {
    dialect: 'sqlite', // sqlite, mysql 或 postgres
    sqlite: { storage: './data/gopay.db', logging: false },
    mysql: { host: '127.0.0.1', database: 'gopay', username: '', password: '' },
    postgres: { host: '127.0.0.1', port: 5432, database: 'gopay', username: '', password: '' }
}
}
```

**注意**：所有支付通道字段必须完整配置才会启用，部分配置会被自动忽略。

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/submit.php` | POST | 下单入口（易支付协议） |
| `/api/order_status` | GET | 订单状态查询 |
| `/pay/alipay_notify` | POST | 支付宝异步回调 |
| `/pay/alipay_return` | GET | 支付宝同步返回 |
| `/pay/wxpay_notify/:appid` | POST | 微信支付异步回调 |
| `/pay/wxpay/native` | GET | 微信扫码支付页面 |
| `/pay/paypal_notify` | POST | PayPal Webhook 回调 |
| `/go` | GET | 支付跳转中间页 |

## 目录结构

```
gopay/
├── app.js              # 入口
├── config.js         # 配置
├── plugins/ # 插件（alipay/wxpay/database/user/paypal）
├── routes/             # 路由
├── utils/              # 工具（签名/回调）
└── templates/          # EJS 模板
```

## 技术栈

- Fastify 3
- Sequelize 6
- SQLite / MySQL / PostgreSQL
- alipay-sdk
- wechatpay-axios-plugin
- @paypal/checkout-server-sdk
