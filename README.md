<p align="center">
  <a href="https://github.com/lopinx/gopay" target="_blank"><img src="https://cdn.lightpanda.io/assets/images/logo/lpd-logo.png" alt="Logo" height=170></a>
</p>

<h1 align="center">GoPay</h1>

<p align="center"><a href="https://github.com/lopinx/gopay">一个兼容易支付的Nodejs版支付系统</a></p>

<div align="center">

[![fastify](https://img.shields.io/github/stars/fastify/fastify)](https://github.com/fastify/fastify)
[![ejs](https://img.shields.io/github/stars/mde/ejs)](https://github.com/mde/ejs)
[![sequelize](https://img.shields.io/github/stars/sequelize/sequelize)](https://github.com/sequelize/sequelize)

</div>

---

### 如果当前网站对接的是易支付，运行本程序后其余完全不需要改动，直接修改域名即可。

> 做这个小程序的初衷是因为易支付代码太垃圾了，业务逻辑不严谨，经常掉单，售后苦不堪言。自己业务替换成 GoPay后基本是0掉单！ 配置也不复杂，只需要配置下网站的配置文件即可，因为是个人使用，不搞什么面板什么的了。

本代码是基于 [GoPay](https://github.com/chris19991226/GoPay) 开发的，感谢作者的开源精神。

本项目相对于原版有以下改动：

- 添加了多数据库支持处理逻辑

  支持 MySQL、MariaDB、PostgreSQL、SQLite 和 Microsoft SQL Server

- 默认数据库引擎：MySQL -> SQLite

- 增加了首页页面支持

### 运行环境

基本环境：[NodeJS](https://github.com/nodejs/node)

### 项目配置

文件： [config.js](config.js)

```javascript
const fs = require('fs');
const path = require('path');

module.exports = function () {
  // 证书文件路径
  /*
    参数说明
    cd gopay
    npm install yargs --save-dev
    cd ./node_modules/.bin
    wxpay crt -m {mchid} -s {serial} -f {privateKey.pem} -k {secret} -o
    输出：
    $ The WeChatPay Platform Certificate#0
    $ serial=36736A4D01F0056B033693E40B6DB995D2A9B6D1
    $ notBefore=Mon, 29 Mar 2021 10:04:33 GMT
    $ notAfter=Sat, 28 Mar 2026 10:04:33 GMT
    $ Saved to: C:\Users\ADMINI~1\AppData\Local\Temp\wechatpay_36736A4D01F0056B033693E40B6DB995D2A9B6DB.pem

    将输出的 serial=36736A4D01F0056B033693E40B6DB995D2A9B6D1 的值作为 key
    将输出的 Saved to: ....\wechatpay_36736A4D01F0056B033693E40B6DB995D2A9B6D1.pem 证书用作 value

    certs: {
        '36736A4D01F0056B033693E40B6DB995D2A9B6D1': fs.readFileSync('./cert/wxpay/wechatpay_36736A4D01F0056B033693E40B6DB995D2A9B6D1.pem'),
    },
    */
  return {
    web: {
      // 支付域名，用于回调通知，结尾不加 /
      payUrl: 'http://localhost:3000',
      sitename: 'GoPay', // 网站名称
      keywords: 'GoPay, 微信支付, 支付宝支付, 易支付', // 网站关键字
      description:
        '做这个小程序的初衷是因为易支付代码太垃圾了，业务逻辑不严谨，经常掉单，售后苦不堪言。自己业务替换成 GoPay后基本是0掉单！ 配置也不复杂，只需要配置下网站的配置文件即可，因为是个人使用，不搞什么面板什么的了。', // 网站描述
      company: 'GoPay Inc.', // 公司名称
      copyright: 'Copyright © 2023 GoPay Inc. All rights reserved.', // 版权信息
      icp: '鄂ICP备2024032629号-1', // 备案信息
      tongji:
        '<script>!function(e,t,n,r,c,a,s){e[n]=e[n]||function(){(e[n].q=e[n].q||[]).push(arguments)},(a=t.createElement(r)).async=1,a.src="https://www.clarity.ms/tag/rnex40upe8?ref=bwt",(s=t.getElementsByTagName(r)[0]).parentNode.insertBefore(a,s)}(window,document,"clarity","script")</script>',
      favicon: 'favicon.ico', // 网站图标
      hometitle: '一个兼容易支付的Nodejs版支付系统', // 网站首页标题
    },

    user: {
      10001: {
        key: 'XM9b0ce7BE6R9NQ897B0wW0LW031B182',
      },
    },

    alipay: [
      // 支付宝实际参数（本例为沙箱信息，https://open.alipay.com/develop/sandbox/）
      {
        appId: '2021000148698595',
        // 应用私钥
        privateKey:
          'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCXh9viuqTT5V+AvC0ekmzoqz26FUBdNIFhO80zPV4lV4HUEIVYp1KsUO1dRRdX8EWyou+oH3BovQQ9TW/zSyr2JDedVcvwxig9VOLH6481LzHyN46RZPlcXehUOE4LxKM4J4K/8eX4Ka5mUhaaZRHoKIzOXNSXfLjcP7Fg68Pcim9Un8fXLOYKVD1fYsGNQcEIDYbFSaP4CFi/f+0Bd6x6Id4Gs2Nk7NN7vcKWiAJYji2c4Q/ELUEAgf9y41cMltdN6w/MjZr/EDx9vkd2CtJxM4fivFLDI+Lz9Kf2IUGy7Z2jz9Tt6/McaykQSplkJ0YdorzIf0o8pcddraGdr/m5AgMBAAECggEARaahH7qDARMxrs7QPnk3rkrn+JzEFROJVNRUIfVXTPrIJl3hrTpb+fDI6lJTxIwgvVe/qRuqY7peNH9fsgkfGjzTg3JoZ6ft3yMhiptwHBYxcxCua45qQFa579xho28jRzCCHRBnkIY4L7gTw6wpavkYn9JztZ4SqspsEgzM3pXcqJm8Wl3fP3qoseae5r4a65RTBoVYEiUOOFCAO/yYJAMgVAaZirBgOzCosvuKonO7BuGnOafZW8gDvsrTZ1uNWIR7cbPsnl+4ZKc096vnsQoC9dYkd1hLV2Mj66kiy2RjsmfXz8V4q/atFCiNbo4nyPTkjzSDb2TF2UdcMCNVMQKBgQDgyjVQ1Hji+0nEcnpPv60CiayKgEDZSlFL6BtsyHseVthv9Iaqt7vEAjgGcFstUDlW6M1xGQ/qWukYlRwC12X1lADxhU4rHb9/RMuzFRFnR0uFhxqxz50bRXFApq/khvHjO/UDFt1J3sTcmUD/uRtvRLxUwlmmN+D2PBDOIx12GwKBgQCskcWgJBlmGjVV+d11Qjxh82wuUSH1WAslM90rtlhVtF/cwkRD3cBICt5A04ClDT2BzRbu5bniQjDJKq67w++KotFfL6DOh9fntdcznFoznIQAl3MJ+fqJaNdFDkUENUUxw8Z5Hz9EXzTA9+P06Zi4Oi6Gt/0H4+4S2yKcAbtcuwKBgEKk8KWkOKri4X3yiry2ES8dbiAp4hAJ7oxYpjjcP1RBXy3iC0L18h8soTuXeBC5JibUIoSTb5qFlXIKUyGshrgGRzlT0lcKHMo4tUPEzUIXaxaNdaad7PA26FrIkIFqWLCMCBoAX18VQrw8W371fGLCuCtQ649SJcobCMh0tLldAoGAX2brUYADhp3AlLphAv1OMnyHdweldWRqLPQCNrNFHIRuZrYDVV2Xenx/qGkE+rpaIZNHNWVNIVekbuIo3WcR25vtkejbxrH024V85mxutY+2rjkMARzws9yA/g1IfG4SxdNMuxNaP6s+l9uza2dk5ZxMsm+u9Bi/Oi9pb8PJWBcCgYEAyhOUo5StZ35KeX+ttIJErh2EzjdiBE7a4vHZsMWg2EuaSfwQTvN35S32NqzjJfngSYtoKxLe2uZvTxIZbWlnQZDDQx1m1LEuJGMCUR60mWBGQ6JFkzT+yRj8qEpQsR/7UHjRbzMR3kigooGxhMQaCiTeuLMhaPVGB/Rr6gRp4Zc=',
        // 支付宝公钥
        alipayPublicKey:
          'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArBfRvQ0nSg8nh6t0/64zz0i60hJiI7sJdvsYAcFZkSC7uYKygqmq32SYtDA3uZd+iURh/ttIImSbE5xWdPRusDxRqEwT8OA7CPCPUdmyvizwwzShm6qKA18OO1Z/WkKMK4uTt6VD+8qSvsHHv8xhsNwm1188z+a11ZNZ2cFHLjfYyzE6SX4JujsWU/EvizXmCEqRWE3kj1RqxwW2aYgZHtxarPHgHnGvt4gtjNlYbk8226YvlDlf8jh5kXzpigIbXZNxk8yY/EA+MYMvrvuvWoF/5evaViIXMEHlxETzunYAFNC3FGQJ/98nDLBfflCvgRZ8aVxMWcpl/VR3CVxmVwIDAQAB',
      },
    ],

    wxpay: [
      {
        appId: 'wx4d12fhry2123', // 微信支付分配的公众账号ID（由微信支付生成并返回）
        mchid: '15207894366', // 商户号, 由微信支付生成的商户号，请登录微信支付商户平台查看
        privateKey: fs.readFileSync('./cert/wxpay/apiclient_key.pem'), // 微信官网通过工具生成的证书 私钥
        serial: '6BA656D82349713BBF909D338A2C50056F745791', // 官网生成证书后，再点击即可显示 证书序列号
        secret: '4izi9ldta1ib8q3iu74vxxxxxxxx', // v2版 32位密钥 ,官网自己设置的
        certs: {
          '36736A4D01F0056B033693E40B6DB995D2A9B6D1': fs.readFileSync(
            './cert/wxpay/wechatpay_36736A4D01F0056B033693E40B6DB995D2A9B6D1.pem'
          ),
        },
        only_native: false, // 是否开启仅扫码 , 如果是在手机上就需要另一个手机扫码，保存相册的native二维码是无法支付的
      },
    ],

    /**
     * 替换源网站至支付宝\微信的订单名称(防止违规关键词（风控）)
     */
    form: {
      subject: {
        rewrite: false,
        text: ['个性手机壳','蓝牙耳机'], // 随机替换
      },
      body: {
        rewrite: true,
        text: ['投诉请联系QQ123456', '投诉请联系QQ123456'], // 随机替换
      },
    },

    // 数据库配置
    db: {
      // 选择要使用的数据库类型: 'sqlite' | 'mysql' | 'postgres' | 'mssql' | 'mariadb'
      use: 'sqlite',

      // 可用的数据库配置
      options: {
        sqlite: {
          storage: './database.sqlite', // 数据库文件路径
          logging: false, // 是否打印SQL日志
        },

        mysql: {
          host: 'localhost',
          port: 3306,
          database: 'gopay',
          username: 'gopay',
          password: 'gopay',
          charset: 'utf8mb4',
          collate: 'utf8mb4_unicode_ci',
          pool: {
            max: 5, // 连接池最大连接数
            min: 0, // 连接池最小连接数
            acquire: 30000, // 连接超时时间（毫秒）
            idle: 10000, // 连接空闲时间（毫秒）
          },
          logging: false, // 是否打印SQL日志
          ssl: true, // 是否启用SSL
          sslOptions: {
            // SSL证书选项
            rejectUnauthorized: false, // 是否拒绝未授权的证书
            // ca: fs.readFileSync('./cert/mysql-ca.pem') // 可选：CA证书
          },
          connectTimeout: 10000, // 连接超时时间（毫秒）
        },

        postgres: {
          host: 'localhost',
          port: 5432,
          database: 'gopay',
          username: 'gopay',
          password: 'gopay',
          pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000,
          },
          logging: false,
          ssl: true, // 是否启用SSL
          rejectUnauthorized: false, // 是否拒绝未授权的证书
          sslOptions: {
            // SSL证书选项
            // ca: fs.readFileSync('./cert/postgres-ca.pem') // 可选：CA证书
          },
        },

        mssql: {
          host: 'localhost',
          port: 1433,
          database: 'gopay',
          username: 'gopay',
          password: 'gopay',
          pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000,
          },
          logging: false,
          encrypt: true, // 是否启用加密
          trustServerCertificate: true, // 是否信任服务器证书
          sslOptions: {
            // SSL证书选项
            // ca: fs.readFileSync('./cert/mssql-ca.pem') // 可选：CA证书
          },
        },

        mariadb: {
          host: 'localhost',
          port: 3306,
          database: 'gopay',
          username: 'gopay',
          password: 'gopay',
          charset: 'utf8mb4',
          collate: 'utf8mb4_unicode_ci',
          pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000,
          },
          logging: false,
          ssl: true, // 是否启用SSL
          sslOptions: {
            // SSL证书选项
            rejectUnauthorized: false,
            // ca: fs.readFileSync('./cert/mariadb-ca.pem') // 可选：CA证书
          },
          connectTimeout: 10000, // 连接超时时间（毫秒）
        },
      },
    },
  };
};
```

#### 配置文件里面基本已经解释的很详细了

- 微信支付权限: **h5支付** / **native支付**

- 支付宝: **PC支付** / **手机网站支付**

#### 支付配置可以配置多个，这样就会自动负载均衡到多个支付主体上，目前手机端/PC是靠浏览器UA识别的，自动调转到各自的支付页面。

[![g3eMq0.png](https://z3.ax1x.com/2021/05/07/g3eMq0.png)](https://imgtu.com/i/g3eMq0)

### 项目运行

```shell
cd gopay
npm install
node app.js
```

### 守护启动

```shell
npm install -g pm2
pm2 start app.js --name=gopay
```

### 代理配置

1. 本地代理: 内网IP:端口

2. 异地代理: 外网IP:端口

### 多数据库

| 数据库     | 推荐驱动           | 方言选项   | 适用场景                    |
| ---------- | ------------------ | ---------- | --------------------------- |
| MySQL      | `mysql2`           | `mysql`    | 主流 Web 应用               |
| PostgreSQL | `pg`               | `postgres` | 需要高级特性（JSONB、数组） |
| SQLite     | `sqlite3`          | `sqlite`   | 测试、嵌入式应用            |
| SQL Server | `tedious`          | `mssql`    | 企业级 .NET 迁移项目        |
| MariaDB    | `mysql2`/`mariadb` | `mariadb`  | 兼容 MySQL 的开源替代方案   |
| Oracle     | `oracledb`         | `oracle`   | 企业级 Oracle 数据库集成    |
| IBM DB2    | `ibm_db`           | `db2`      | 大型企业遗留系统            |

**驱动选择建议**

1. **优先使用推荐驱动**：Sequelize 对每个数据库都有官方推荐的驱动，兼容性最佳。

2. **性能敏感场景**：

   - MySQL/MariaDB：选 `mysql2`（原生 C++ 绑定性能更高）。
   - PostgreSQL：选 `pg-native`（需编译，但性能优于纯 JS 的 `pg`）。

3. **兼容性注意**：

   - SQLite 不支持高级 SQL 特性（如 `FULL OUTER JOIN`）。
   - SQL Server 需要特殊配置处理日期时间格式。
