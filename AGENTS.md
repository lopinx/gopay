# 项目知识库

**生成时间:** 2026-03-10
**提交:** f99d691
**分支:** main

## 概述

GoPay — 兼容易支付（epay）协议的 Node.js 聚合支付系统。支持支付宝（PC/手机网站）和微信支付（H5/Native扫码），通过 UA 自动识别终端类型。

技术栈：Fastify 3 + Sequelize 6 + MySQL2 + EJS 模板

## 结构

```
gopay/
├── app.js              # 应用入口，注册所有插件和路由
├── config.js        # 全局配置（支付密钥、数据库、域名）⚠️ 含敏感信息
├── plugins/            # Fastify 插件（通过 autoload 自动加载）
│   ├── alipay.js       # 支付宝 SDK 封装 + 实例缓存池
│   ├── wxpay.js        # 微信支付 v3 SDK 封装 + 实例缓存池
│   ├── mysql.js        # Sequelize 初始化 + Order 模型定义
│   ├── user.js         # 易支付商户（PID）查询
│   └── constans.js     # 统一响应码常量（注意：文件名拼写错误，非 constants）
├── routes/             # API 路由（通过 autoload 自动加载）
│   ├── submit.js       # POST /submit.php — 核心下单入口（兼容易支付）
│   ├── order.js        # GET /api/order_status — 订单状态查询 + GET /test
│   ├── redirect.js     # GET /go — 支付跳转中间页
│   └── pay/
│       ├── alipay/
│       │   └── notify.js   # POST /pay/alipay_notify + GET /pay/alipay_return
│       └── wechat/
│           ├── notify.js   # POST /pay/wxpay_notify/:appid — 微信异步回调
│           └── native.js   # GET /pay/wxpay/native — 扫码支付页面
├── utils/
│   ├── stringutils.js  # 字符串工具：签名计算、参数排序、MD5、UA检测
│   └── epayutils.js    # 易支付回调 URL 构建（notify + return）
├── templates/          # EJS 模板
│   ├── submit.ejs      # 下单后自动跳转表单
│   ├── jump.ejs        # 通用跳转页
│   └── wechat/
│       ├── pc_native_pay.ejs   # PC 扫码支付页
│       └── m_native_pay.ejs    # 手机扫码支付页
└── public/assets/      # 静态资源（CSS/JS/图标/Layer弹窗）
```

## 查找指南

| 任务 | 位置 | 说明 |
|------|------|------|
| 新增支付渠道 | `plugins/` + `routes/submit.js` | 新建插件封装SDK，在submit.js增加type分支 |
| 修改签名逻辑 | `utils/stringutils.js` | `checkSign`/`epaySign` — MD5签名 |
| 修改回调通知 | `utils/epayutils.js` | 构建源站回调URL的两个函数 |
| 数据库模型 | `plugins/mysql.js` | 仅一张表 `gopay_order`，Sequelize自动sync |
| 响应码/错误码 | `plugins/constans.js` | `fastify.resp.*` 统一响应 |
| 支付配置 | `config.js` | 支付宝/微信密钥、商户信息、数据库连接 |
| 微信证书 | `./cert/wxpay/` | 已被 .gitignore 忽略，需手动放置 |

## 业务流程

```
客户端 → POST /submit.php（易支付协议参数）
  ↓ 验签（MD5）
  ↓ 根据 type 分发：alipay / wxpay
  ↓ 随机选取支付实例（负载均衡）
  ↓ 重写订单名称（form.subject 防风控）
  ↓ 创建 Order 记录（status=0）
  ↓ 调用支付SDK获取支付链接
  ↓ 渲染 submit.ejs → 自动跳转支付页

支付完成 → 支付宝/微信回调 notify 路由
  ↓ 验签（支付宝RSA2 / 微信AES解密）
  ↓ 更新 Order status=1
  ↓ 构建易支付协议回调URL
  ↓ HTTP GET 通知源站（axios，重试3次）
```

## 约定

- **插件模式**：所有插件使用 `fastify-plugin` 包装，通过 `fastify.decorate()` 挂载到实例
- **配置传递**：`config.js` 作为 `opts` 传入所有插件和路由（autoload options）
- **SDK缓存**：支付宝和微信SDK实例通过 `payCachePool` 对象缓存，避免重复创建
- **通道校验**：插件初始化时自动过滤不完整的支付通道配置，所有必填字段非空才启用
- **负载均衡**：配置多个支付账号时，`Math.random()` 从已验证通道中随机选取
- **订单号**：微信支付使用自生成 UUID（去横线大写），支付宝使用源站 `out_trade_no`
- **金额**：支付宝单位为元（字符串），微信单位为分（`parseInt(money) * 100`）
- **终端识别**：`stringUtils.checkMobile(ua)` 通过 User-Agent 关键词判断移动端
- **时区**：MySQL 连接强制 `+08:00`

## 反模式（本项目禁止）

- **不要** 直接修改 `config.js` 中的示例密钥后提交 — 含真实 appId
- **不要** 在 `payCachePool` 外创建支付SDK实例 — 会导致内存泄漏
- **不要** 修改 `/submit.php` 路由路径 — 兼容易支付协议，源站依赖此路径
- **不要** 改动签名算法参数顺序 — `filterParams` → `sortParams` → MD5 是易支付标准流程
- **注意** `constans.js` 文件名拼写错误（少了 t），但不要重命名 — autoload 依赖文件名

## 已知问题

- 微信支付 `notify.js` 第62行 `const {data, status}` 与外层 `data` 变量名冲突（`let data = JSON.parse(decryptJson)`）
- `submit.js` 中支付宝支付错误被静默吞掉（`catch(e)` 中仅设 `err=true`）
- `user.js` 中 `pid instanceof Number` 对原始类型永远返回 false（应用 `typeof`）
- 无输入校验中间件，参数校验散落在各路由中
- 微信支付金额 `parseInt(money)` 不支持小数（如 0.01 元会变成 0 分）

## 命令

```bash
# 开发
node app.js                        # 直接启动，默认端口 3000
npm run dev                        # fastify-cli 热重载启动

# 生产
npm install -g pm2
pm2 start app.js --name=gopay      # 守护进程启动

# 测试
npm test                           # tap test/**/*.test.js（test/ 已在 .gitignore）

# 微信证书获取
cd ./node_modules/.bin
wxpay crt -m {mchid} -s {serial} -f {privateKey.pem} -k {secret} -o
```

## 备注

- 项目名 GoPay 与 Go 语言无关，是"易支付"的替代品
- `.gitignore` 排除了 `/cert/` 和 `/test/` 目录
- 无 CI/CD 配置、无 Dockerfile、无 linter — 个人项目风格
- Fastify v3 + 相关插件版本较旧，升级需注意 API 变更
- `config.js` 中已包含真实 `appId`（支付宝 2020001169673295），敏感信息需脱敏
