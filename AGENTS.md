# GoPay 项目知识库

**生成时间:** 2026-03-21
**提交:** d9ae1e4
**分支:** main

## 概述

GoPay — 兼容易支付（epay）协议的 Node.js 聚合支付系统。支持支付宝（PC/手机网站）和微信支付（H5/Native扫码），通过 UA 自动识别终端类型。

**技术栈：** Fastify 5 + Sequelize 6 + SQLite/MySQL/PostgreSQL + EJS

## 结构

```
gopay/
├── app.js                    # 入口：注册插件、路由、axios拦截器
├── config.js                 # 全局配置（支付密钥、数据库、域名）⚠️ 含敏感信息
├── plugins/                  # Fastify 插件（autoload 自动加载）
│   ├── alipay.js             # 支付宝 SDK + payCachePool 缓存
│   ├── wxpay.js              # 微信支付 v3 SDK + payCachePool 缓存
│   ├── database.js           # Sequelize + Order 模型（单表 gopay_order）
│   ├── user.js               # 易支付商户 PID 查询
│   └── constans.js           # 响应码（文件名拼写错误，勿改）
├── routes/                   # API 路由（autoload）
│   ├── submit.js             # POST /submit.php — 核心下单入口
│   ├── order.js              # GET /api/order_status
│   ├── redirect.js           # GET /go 支付跳转中间页
│   ├── health.js             # GET /health + /ready 健康检查
│   └── pay/
│       ├── alipay/notify.js  # POST /pay/alipay_notify + GET /pay/alipay_return
│       └── wechat/
│           ├── notify.js       # POST /pay/wxpay_notify/:appid
│           └── native.js       # GET /pay/wxpay/native 扫码页
├── utils/
│   ├── stringutils.js        # 签名：filterParams→sortParams→MD5，UA检测
│   ├── epayutils.js          # 构建源站回调 URL
│   └── security.js           # 安全工具：URL验证、金额校验等
├── test/                     # E2E 测试
│   ├── e2e.test.js           # 端到端测试
│   └── setup.js              # 测试辅助函数
├── templates/                # EJS 视图
├── public/assets/            # 静态资源
├── .husky/                   # Git hooks
│   └── pre-commit            # 提交前钩子
├── .prettierrc.json          # Prettier 配置
├── .prettierignore           # Prettier 忽略规则
├── .lintstagedrc.json        # lint-staged 配置
├── jest.config.js            # Jest 测试配置
├── SECURITY.md               # 安全说明
└── LICENSE                   # MIT 许可证
```

## 查找指南

| 任务         | 位置                            | 说明                                                    |
| ------------ | ------------------------------- | ------------------------------------------------------- |
| 新增支付渠道 | `plugins/` + `routes/submit.js` | 新建插件封装SDK，submit.js增加type分支                  |
| 修改签名逻辑 | `utils/stringutils.js`          | `checkSign`/`epaySign` — MD5签名，含时序攻击防护        |
| 修改回调通知 | `utils/epayutils.js`            | `buildPayNotifyCallbackUrl`/`buildPayReturnCallbackUrl` |
| 安全工具     | `utils/security.js`             | URL安全验证、金额校验、HTML转义                         |
| 数据库模型   | `plugins/database.js`           | 单表 `gopay_order`，含索引优化                          |
| 响应码       | `plugins/constans.js`           | `fastify.resp.*`（EMPTY_PARAMS/SIGN_ERROR等）           |
| 支付配置     | `config.js`                     | 支付宝/微信密钥、商户信息、数据库连接                   |
| 微信证书     | `./cert/wxpay/`                 | .gitignore 已忽略                                       |
| 健康检查     | `routes/health.js`              | `/health` 和 `/ready` 端点                              |

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

| 问题             | 位置                             | 修复内容                                   |
| ---------------- | -------------------------------- | ------------------------------------------ |
| ~~变量遮蔽~~     | `routes/pay/wechat/notify.js:62` | 重命名为 `responseData`                    |
| ~~错误吞没~~     | `routes/submit.js:159-162`       | 添加 `fastify.log.error`                   |
| ~~类型检查错误~~ | `plugins/user.js:7`              | 改为 `typeof pid === 'number'`             |
| ~~金额精度~~     | `routes/submit.js:191`           | 改为 `Math.round(parseFloat(money) * 100)` |

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

## Git 提交规范

本项目遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范，提交信息使用**简体中文**。

### 提交信息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 类型（type）

| 类型       | 说明                                   | 示例                              |
| ---------- | -------------------------------------- | --------------------------------- |
| `feat`     | 新功能                                 | `feat: 添加微信支付退款功能`      |
| `fix`      | 修复 bug                               | `fix: 修复订单状态更新失败的问题` |
| `docs`     | 文档更新                               | `docs: 更新 API 接口文档`         |
| `style`    | 代码格式（不影响代码运行的变动）       | `style: 格式化代码，去除多余空格` |
| `refactor` | 重构（既不是新增功能，也不是修复 bug） | `refactor: 重构支付回调处理逻辑`  |
| `perf`     | 性能优化                               | `perf: 优化数据库查询性能`        |
| `test`     | 增加测试                               | `test: 添加订单创建单元测试`      |
| `chore`    | 构建过程或辅助工具的变动               | `chore: 升级依赖版本`             |
| `security` | 安全相关修复                           | `security: 修复原型链污染漏洞`    |

### 范围（scope）

可选，用于指定影响的模块：

- `alipay` - 支付宝相关
- `wxpay` - 微信支付相关
- `order` - 订单模块
- `config` - 配置文件
- `database` - 数据库相关
- `docs` - 文档
- `test` - 测试相关
- `utils` - 工具函数
- `deps` - 依赖

### 主题（subject）

- 使用**简体中文**
- 首字母小写
- 动词开头，不要加句号
- 简明扼要，不超过 50 个字符

### 正文（body）

- 可选
- 详细描述修改内容
- 使用简体中文
- 可以包含多个段落
- 说明修改原因和与之前行为的对比

### 页脚（footer）

- 可选
- 用于引用 Issue 或 PR
- 格式：`Closes #123` 或 `Refs #456`

### 提交示例

```bash
# 添加新功能
git commit -m "feat(order): 添加订单超时自动取消功能" \
           -m "当订单超过30分钟未支付时，自动将状态设置为已取消" \
           -m "Closes #42"

# 修复问题
git commit -m "fix(alipay): 修复回调验签失败的问题" \
           -m "检查 notify_url 中的 sign 参数是否正确拼接"

# 文档更新
git commit -m "docs: 更新部署文档，添加 Docker 部署说明"

# 安全修复
git commit -m "security(stringutils): 修复原型链污染漏洞" \
           -m "添加 hasOwnProperty 检查，防止恶意参数污染原型链"

# 重构
git commit -m "refactor(utils): 重构签名验证逻辑" \
           -m "将签名生成和验证提取到独立模块，提高可测试性"

# 性能优化
git commit -m "perf(database): 添加订单查询索引" \
           -m "在 out_trade_no 和 status 字段添加索引，查询性能提升 10 倍"
```

### 注意事项

1. **敏感信息**：禁止提交包含真实密钥、密码的配置文件
2. **测试**：重要功能提交前确保测试通过 (`npm test`)
3. **文档**：功能变更需同步更新相关文档
4. **粒度**：一次提交只做一件事，便于代码审查和回滚

## 命令

```bash
# 开发
node app.js           # 直接启动，端口 3000
npm run dev           # fastify-cli 热重载

# 生产
pm2 start app.js --name=gopay  # 守护进程

# 测试
npm test              # Jest 测试
npm run test:watch    # Jest 监听模式

# 格式化
npm run format        # Prettier 格式化所有文件
npm run format:check  # 检查格式
npm run lint          # 运行 linter

# 微信证书
cd ./node_modules/.bin
wxpay crt -m {mchid} -s {serial} -f {privateKey.pem} -k {secret} -o
```

## Git 提交规范
