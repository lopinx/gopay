# GoPay 项目知识库

**生成时间:** 2026-03-19
**提交:** bc78c88
**分支:** main

## 概述

GoPay — 兼容易支付（epay）协议的 Node.js 聚合支付系统。支持支付宝（PC/手机网站）和微信支付（H5/Native扫码），通过 UA 自动识别终端类型。

**技术栈：** Fastify 3 + Sequelize 6 + SQLite/MySQL/PostgreSQL + EJS

## 结构

```
gopay/
├── app.js              # 入口：注册插件、路由、axios拦截器
├── config.js           # 全局配置（支付密钥、数据库、域名）⚠️ 含敏感信息
├── plugins/            # Fastify 插件（autoload 自动加载）
│   ├── alipay.js       # 支付宝 SDK + payCachePool 缓存
│   ├── wxpay.js        # 微信支付 v3 SDK + payCachePool 缓存
│   ├── database.js     # Sequelize + Order 模型（单表 gopay_order）
│   ├── user.js         # 易支付商户 PID 查询
│   └── constans.js     # 响应码（文件名拼写错误，勿改）
├── routes/             # API 路由（autoload）
│   ├── submit.js       # POST /submit.php — 核心下单入口
│   ├── order.js        # GET /api/order_status
│   ├── redirect.js     # GET /go 支付跳转中间页
│   └── pay/
│       ├── alipay/notify.js   # POST /pay/alipay_notify + GET /pay/alipay_return
│       └── wechat/
│           ├── notify.js      # POST /pay/wxpay_notify/:appid
│           └── native.js      # GET /pay/wxpay/native 扫码页
├── utils/
│   ├── stringutils.js  # 签名：filterParams→sortParams→MD5，UA检测
│   └── epayutils.js    # 构建源站回调 URL
├── templates/          # EJS 视图
└── public/assets/      # 静态资源
```

## 查找指南

| 任务 | 位置 | 说明 |
|------|------|------|
| 新增支付渠道 | `plugins/` + `routes/submit.js` | 新建插件封装SDK，submit.js增加type分支 |
| 修改签名逻辑 | `utils/stringutils.js` | `checkSign`/`epaySign` — MD5签名 |
| 修改回调通知 | `utils/epayutils.js` | `buildPayNotifyCallbackUrl`/`buildPayReturnCallbackUrl` |
| 数据库模型 | `plugins/database.js` | 单表 `gopay_order`，字段：id/out_trade_no/notify_url/return_url/type/pid/title/money/status |
| 响应码 | `plugins/constans.js` | `fastify.resp.*`（EMPTY_PARAMS/SIGN_ERROR等） |
| 支付配置 | `config.js` | 支付宝/微信密钥、商户信息、数据库连接 |
| 微信证书 | `./cert/wxpay/` | .gitignore 已忽略 |

## 业务流程

```
POST /submit.php
  ↓ 参数校验（UA/type/pid/name/notify_url/return_url/money/out_trade_no/sign）
  ↓ PID查询 → fastify.user.getUser(pid)
  ↓ 签名验证 → filterParams → sortParams → MD5(params + ukey)
  ↓ 类型分发
  ├─ alipay → alipay.exec() → Order.create(out_trade_no)
  └─ wxpay  → wxpay.exec() → Order.create(UUID)
  ↓ 渲染 submit.ejs → 自动跳转支付页

支付完成回调
  ├─ POST /pay/alipay_notify → RSA2验签 → update status=1 → GET源站notify_url
  └─ POST /pay/wxpay_notify/:appid → AES解密 → update status=1 → GET源站notify_url
```

## 约定

- **插件模式**：`fastify-plugin` 包装 + `fastify.decorate()` 挂载
- **配置传递**：`config.js` 作为 `opts` 传入所有插件和路由
- **SDK缓存**：`payCachePool` 对象缓存实例，禁止外部创建
- **通道校验**：插件初始化过滤不完整配置，必填字段非空才启用
- **负载均衡**：`Math.random()` 从已验证通道随机选取
- **订单号**：支付宝用源站 `out_trade_no`，微信用自生成 UUID
- **金额**：支付宝元（字符串），微信分（`parseInt * 100`）
- **终端识别**：`checkMobile(ua)` 匹配 User-Agent 关键词
- **时区**：数据库连接强制 `+08:00`
- **异步风格**：路由用 `async/await`，拦截器用 Promise 链

## 反模式（本项目禁止）

- **禁止** 直接修改 `config.js` 示例密钥后提交 — 含真实 appId
- **禁止** 在 `payCachePool` 外创建 SDK 实例 — 内存泄漏
- **禁止** 修改 `/submit.php` 路由路径 — 易支付协议兼容
- **禁止** 改动签名算法参数顺序 — 易支付标准流程
- **禁止** 重命名 `constans.js` — autoload 依赖文件名

## 已修复问题

| 问题 | 位置 | 修复内容 |
|------|------|----------|
| ~~变量遮蔽~~ | `routes/pay/wechat/notify.js:62` | 重命名为 `responseData` |
| ~~错误吞没~~ | `routes/submit.js:159-162` | 添加 `fastify.log.error` |
| ~~类型检查错误~~ | `plugins/user.js:7` | 改为 `typeof pid === 'number'` |
| ~~金额精度~~ | `routes/submit.js:191` | 改为 `Math.round(parseFloat(money) * 100)` |

## 新增功能

- **全局错误处理器** `app.js` - 统一错误响应格式
- **输入校验** `routes/submit.js` - URL格式、金额范围校验

## 命令

```bash
# 开发
node app.js                    # 直接启动，端口 3000
npm run dev                    # fastify-cli 热重载

# 生产
pm2 start app.js --name=gopay  # 守护进程

# 测试
npm test                       # tap test/**/*.test.js

# 微信证书
cd ./node_modules/.bin
wxpay crt -m {mchid} -s {serial} -f {privateKey.pem} -k {secret} -o
```

## 备注

- 项目名与 Go 语言无关，是"易支付"替代品
- `.gitignore` 排除 `/cert/` 和 `/test/`
- 无 CI/CD、无 Dockerfile、无 linter — 个人项目风格
- Fastify v3 版本较旧，升级需注意 API 变更
- config.js 已包含真实 appId，敏感信息需脱敏
