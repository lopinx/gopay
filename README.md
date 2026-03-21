# GoPay

> 兼容易支付（epay）协议的 Node.js 聚合支付系统

初衷：易支付代码业务逻辑不严谨，经常掉单。替换成 GoPay 后基本 0 掉单！

## 特性

- ✅ 兼容易支付协议，源站无需改动
- ✅ 支付宝：PC 网站支付、手机网站支付
- ✅ 微信支付：H5 支付、Native 扫码
- ✅ 多通道负载均衡（随机选取）
- ✅ UA 自动识别终端类型
- ✅ 订单标题自动重写（防风控）
- ✅ 启动校验：仅启用配置完整的通道
- ✅ 数据库：SQLite（默认）/ MySQL / PostgreSQL

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（热重载）
npm run dev

# 生产模式
node app.js
# 或使用 PM2 守护进程
pm2 start app.js --name=gopay
```

服务默认监听 `127.0.0.1:3000`

## 配置

编辑 `config.js`：

```javascript
module.exports = {
  web: {
    payUrl: "https://pay.example.com", // 支付域名，用于回调通知
  },
  user: {
    10001: { key: "商户密钥" }, // PID → KEY 映射
  },
  alipay: [
    {
      appId: "20210001xxxx",
      privateKey: "应用私钥",
      alipayPublicKey: "支付宝公钥",
    },
  ],
  wxpay: [
    {
      appId: "wx1234567890",
      mchid: "1234567890",
      privateKey: fs.readFileSync("./cert/wxpay/apiclient_key.pem"),
      serial: "证书序列号",
      secret: "APIv3密钥",
      certs: { 平台证书序列号: fs.readFileSync("./cert/wxpay/platform.pem") },
      only_native: false, // true 则强制扫码模式
    },
  ],
  form: {
    subject: { rewrite: true, text: ["商品A", "商品B"] }, // 随机标题防风控
    body: { rewrite: true, text: "商品描述" },
  },
  db: {
    dialect: "sqlite", // sqlite | mysql | postgres
    sqlite: { storage: "./data/gopay.db", logging: false },
    mysql: { host: "127.0.0.1", database: "gopay", username: "", password: "" },
    postgres: { host: "127.0.0.1", port: 5432, database: "gopay", username: "", password: "" },
  },
};
```

**重要**：

- 支付通道所有必填字段必须完整配置，否则该通道会被忽略
- 微信证书需提前通过 `wxpay crt` 命令获取

## 微信证书配置

```bash
cd ./node_modules/.bin
wxpay crt -m {mchid} -s {serial} -f {privateKey.pem} -k {secret} -o
```

将输出的证书文件放入 `./cert/wxpay/` 目录。

## API 接口

| 接口                       | 方法 | 说明                       |
| -------------------------- | ---- | -------------------------- |
| `/submit.php`              | POST | 下单入口（易支付协议兼容） |
| `/api/order_status`        | GET  | 订单状态查询               |
| `/pay/alipay_notify`       | POST | 支付宝异步回调             |
| `/pay/alipay_return`       | GET  | 支付宝同步返回             |
| `/pay/wxpay_notify/:appid` | POST | 微信支付异步回调           |
| `/pay/wxpay/native`        | GET  | 微信扫码支付页面           |
| `/go`                      | GET  | 支付跳转中间页             |

## 目录结构

```
gopay/
├── app.js              # 入口：插件/路由注册、axios拦截器
├── config.js           # 全局配置（⚠️ 含敏感信息）
├── plugins/            # Fastify 插件
│   ├── alipay.js       # 支付宝 SDK 封装
│   ├── wxpay.js        # 微信支付 SDK 封装
│   ├── database.js     # Sequelize + Order 模型
│   ├── user.js         # 商户 PID 查询
│   └── constans.js     # 响应码常量
├── routes/             # API 路由
│   ├── submit.js       # 核心下单入口
│   ├── order.js        # 订单查询
│   ├── redirect.js     # 跳转中间页
│   └── pay/            # 支付回调
├── utils/              # 工具函数
│   ├── stringutils.js  # 签名/UA检测
│   └── epayutils.js    # 回调URL构建
├── templates/          # EJS 视图
├── public/assets/      # 静态资源
└── cert/wxpay/         # 微信证书（.gitignore）
```

## 技术栈

| 组件                   | 版本  | 说明            |
| ---------------------- | ----- | --------------- |
| Fastify                | 3.x   | Web 框架        |
| Sequelize              | 6.x   | ORM             |
| alipay-sdk             | 3.x   | 支付宝 SDK      |
| wechatpay-axios-plugin | 0.9.x | 微信支付 v3 SDK |
| EJS                    | 3.x   | 模板引擎        |

## 开发命令

```bash
npm run dev    # fastify-cli 热重载
npm test       # tap 测试
node app.js    # 直接启动
```

## 注意事项

- `/submit.php` 路由路径不可修改（易支付协议兼容）
- `constans.js` 文件名拼写错误但不可修改（autoload 依赖）
- 微信支付金额使用 `parseInt`，不支持小数（如 0.01 元会变成 0 分）
- 无 CI/CD、无 Dockerfile、无 linter 配置

## License

ISC
