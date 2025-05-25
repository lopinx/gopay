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
      payUrl: 'http://gopay.wsl.localhost',
    },

    user: {
      10001: {
        key: 'XM9b0ce7BE6R9NQ897B0wW0LW031B182',
      },
    },

    alipay: [
      {
        appId: '2019093330229234',
        // 应用私钥
        privateKey: '',
        // 支付宝公钥
        alipayPublicKey: '',
      },
    ],

    wxpay: [
      {
        appId: 'wx0ab62649be6b9c65',
        mchid: '1572025941',
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
        rewrite: true,
        text: ['个性手机壳','蓝牙耳机'], // 随机替换
      },
      body: {
        rewrite: true,
        text: ['投诉请联系QQ123456', '投诉请联系QQ123456'],  // 随机替换
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
