const fs = require('fs');
const path = require('path');

// 安全读取文件的函数
function safeReadFileSync(filePath, defaultValue = '') {
  try {
    // 检查文件路径是否安全（防止路径遍历攻击）
    const resolvedPath = path.resolve(filePath);
    const basePath = path.resolve('.');
    
    if (!resolvedPath.startsWith(basePath)) {
      console.warn(`Certificate file path is not safe: ${filePath}`);
      return defaultValue;
    }
    
    if (fs.existsSync(resolvedPath)) {
      return fs.readFileSync(resolvedPath);
    } else {
      console.warn(`Certificate file not found: ${resolvedPath}`);
      return defaultValue;
    }
  } catch (error) {
    console.warn(`Error reading certificate file ${filePath}:`, error.message);
    return defaultValue;
  }
}

// 验证配置参数的函数
function validateConfig(config) {
  // 验证支付URL
  if (!config.web.payUrl || config.web.payUrl.trim() === '') {
    console.warn('警告: payUrl 未配置或为空');
  }
  
  // 验证用户配置
  if (!config.user || Object.keys(config.user).length === 0) {
    console.warn('警告: 未配置任何用户');
  }
  
  // 验证支付宝配置
  if (config.alipay && Array.isArray(config.alipay)) {
    config.alipay.forEach((alipayConfig, index) => {
      if (alipayConfig.appId && alipayConfig.appId.trim() !== '') {
        if (!alipayConfig.privateKey || alipayConfig.privateKey.trim() === '') {
          console.warn(`警告: 支付宝配置[${index}]缺少privateKey`);
        }
        if (!alipayConfig.alipayPublicKey || alipayConfig.alipayPublicKey.trim() === '') {
          console.warn(`警告: 支付宝配置[${index}]缺少alipayPublicKey`);
        }
      }
    });
  }
  
  // 验证微信支付配置
  if (config.wxpay && Array.isArray(config.wxpay)) {
    config.wxpay.forEach((wxpayConfig, index) => {
      if (wxpayConfig.appId && wxpayConfig.appId.trim() !== '') {
        if (!wxpayConfig.mchid || wxpayConfig.mchid.trim() === '') {
          console.warn(`警告: 微信支付配置[${index}]缺少mchid`);
        }
        if (!wxpayConfig.privateKey || wxpayConfig.privateKey.trim() === '') {
          console.warn(`警告: 微信支付配置[${index}]缺少privateKey`);
        }
        if (!wxpayConfig.serial || wxpayConfig.serial.trim() === '') {
          console.warn(`警告: 微信支付配置[${index}]缺少serial`);
        }
        if (!wxpayConfig.secret || wxpayConfig.secret.trim() === '') {
          console.warn(`警告: 微信支付配置[${index}]缺少secret`);
        }
        if (!wxpayConfig.certs || Object.keys(wxpayConfig.certs).length === 0) {
          console.warn(`警告: 微信支付配置[${index}]缺少certs`);
        }
      }
    });
  }
  
  return config;
}

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
  const config = {
    web: {
      // 支付域名，用于回调通知，结尾不加 /
      payUrl: process.env.PAY_URL || 'http://gopay.wsl.localhost',
    },

    user: {
      10001: {
        key: process.env.USER_KEY || 'XM9b0ce7BE6R9NQ897B0wW0LW031B182',
      },
    },

    alipay: [
      {
        appId: process.env.ALIPAY_APP_ID || '2019093330229234',
        // 应用私钥
        privateKey: process.env.ALIPAY_PRIVATE_KEY || 'MIIEowIBAAKCAQEAl4fb4rqk0+VfgLwtHpJs6Ks9uhVAXTSBYTvNMz1eJVeB1BCFWKdSrFDtXUUXV/BFsqLvqB9waL0EPU1v80sq9iQ3nVXL8MYoPVTix+uPNS8x8jeOkWT5XF3oVDhOC8SjOCeCv/Hl+CmuZlIWmmUR6CiMzlzUl3y43D+xYOvD3IpvVJ/H1yzmClQ9X2LBjUHBCA2GxUmj+AhYv3/tAXeseiHeBrNjZOzTe73ClogCWI4tnOEPxC1BAIH/cuNXDJbXTesPzI2a/xA8fb5HdgrScTOH4rxSwyPi8/Sn9iFBsu2do8/U7evzHGspEEqZZCdGHaK8yH9KPKXHXa2hna/5uQIDAQABAoIBAEWmoR+6gwETMa7O0D55N65K5/icxBUTiVTUVCH1V0z6yCZd4a06W/nwyOpSU8SMIL1Xv6kbqmO6XjR/X7IJHxo804NyaGen7d8jIYqbcBwWMXMQrmuOakBWue/cYaNvI0cwgh0QZ5CGOC+4E8OsKWr5GJ/Sc7WeEqrKbBIMzN6V3KiZvFpd3z96qLHmnua+GuuUUwaFWBIlDjhQgDv8mCQDIFQGmYqwYDswqLL7iqJzuwbhpzmn2VvIA77K02dbjViEe3Gz7J5fuGSnNPer57EKAvXWJHdYS1djI+upIstkY7Jn18/FeKv2rRQojW6OJ8j05I80g29kxdlHXDAjVTECgYEA4Mo1UNR44vtJxHJ6T7+tAomsioBA2UpRS+gbbMh7HlbYb/SGqre7xAI4BnBbLVA5VujNcRkP6lrpGJUcAtdl9ZQA8YVOKx2/f0TLsxURZ0dLhYcasc+dG0VxQKav5Ibx4zv1AxbdSd7E3JlA/7kbb0S8VMJZpjfg9jwQziMddhsCgYEArJHFoCQZZho1VfnddUI8YfNsLlEh9VgLJTPdK7ZYVbRf3MJEQ93ASAreQNOApQ09gc0W7uW54kIwySquu8PviqLRXy+gzofX57XXM5xaM5yEAJdzCfn6iWjXRQ5FBDVFMcPGeR8/RF80wPfj9OmYuDouhrf9B+PuEtsinAG7XLsCgYBCpPClpDiq4uF98oq8thEvHW4gKeIQCe6MWKY43D9UQV8t4gtC9fIfLKE7l3gQuSYm1CKEk2+ahZVyClMhrIa4Bkc5U9JXChzKOLVDxM1CF2sWjXWmnezwNuhayJCBaliwjAgaAF9fFUK8PFt+9XxiwrgrUOuPUiXKGwjIdLS5XQKBgF9m61GAA4adwJS6YQL9TjJ8h3cHpXVkaiz0AjazRRyEbma2A1Vdl3p8f6hpBPq6WiGTRzVlTSFXpG7iKN1nEdub7ZHo28ax9NuFfOZsbrWPtq45DAEc8LPcgP4NSHxuEsXTTLsTWj+rPpfbs2tnZOWcTLJvrvQYvzovaW/DyVgXAoGBAMoTlKOUrWd+Snl/rbSCRK4dhM43YgRO2uLx2bDFoNhLmkn8EE7zd+Ut9jas4yX54EmLaCsS3trmb08SGW1pZ0GQw0MdZtSxLiRjAlEetJlgRkOiRZM0/skY/KhKULEf+1B40W8zEd5IoKKBsYTEGgok3rizIWj1Rgf0a+oEaeGX',
        // 支付宝公钥
        alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArBfRvQ0nSg8nh6t0/64zz0i60hJiI7sJdvsYAcFZkSC7uYKygqmq32SYtDA3uZd+iURh/ttIImSbE5xWdPRusDxRqEwT8OA7CPCPUdmyvizwwzShm6qKA18OO1Z/WkKMK4uTt6VD+8qSvsHHv8xhsNwm1188z+a11ZNZ2cFHLjfYyzE6SX4JujsWU/EvizXmCEqRWE3kj1RqxwW2aYgZHtxarPHgHnGvt4gtjNlYbk8226YvlDlf8jh5kXzpigIbXZNxk8yY/EA+MYMvrvuvWoF/5evaViIXMEHlxETzunYAFNC3FGQJ/98nDLBfflCvgRZ8aVxMWcpl/VR3CVxmVwIDAQAB',
      },
    ],

    wxpay: [
      {
        appId: process.env.WXPAY_APP_ID || 'wx0ab62649be6b9c65',
        mchid: process.env.WXPAY_MCHID || '1572025941',
        // 在开发环境中使用模拟数据而不是实际证书文件
        privateKey: process.env.NODE_ENV === 'development' ? 'test_private_key' : 
                   safeReadFileSync('./cert/wxpay/apiclient_key.pem', 'test_private_key'), // 微信官网通过工具生成的证书 私钥
        serial: process.env.WXPAY_SERIAL || '6BA656D82349713BBF909D338A2C50056F745791', // 官网生成证书后，再点击即可显示 证书序列号
        secret: process.env.WXPAY_SECRET || '4izi9ldta1ib8q3iu74vxxxxxxxx', // v2版 32位密钥 ,官网自己设置的
        certs: {
          '36736A4D01F0056B033693E40B6DB995D2A9B6D1': process.env.NODE_ENV === 'development' ? 'test_cert' :
            safeReadFileSync('./cert/wxpay/wechatpay_36736A4D01F0056B033693E40B6DB995D2A9B6D1.pem', 'test_cert')
        },
        only_native: process.env.WXPAY_ONLY_NATIVE === 'true' || false, // 是否开启仅扫码 , 如果是在手机上就需要另一个手机扫码，保存相册的native二维码是无法支付的
      },
    ],

    /**
     * 替换源网站至支付宝\微信的订单名称(防止违规关键词（风控）)
     */
    form: {
      subject: {
        rewrite: true,
        text: process.env.FORM_SUBJECT_TEXT ? process.env.FORM_SUBJECT_TEXT.split(',') : ['个性手机壳','蓝牙耳机'], // 随机替换
      },
      body: {
        rewrite: true,
        text: process.env.FORM_BODY_TEXT ? process.env.FORM_BODY_TEXT.split(',') : ['投诉请联系QQ123456', '投诉请联系QQ123456'],  // 随机替换
      },
    },

    // 数据库配置
    db: {
      // 选择要使用的数据库类型: 'sqlite' | 'mysql' | 'postgres' | 'mssql' | 'mariadb'
      use: process.env.DB_TYPE || 'sqlite',

      // 可用的数据库配置
      options: {
        sqlite: {
          storage: process.env.SQLITE_STORAGE || './database.sqlite', // 数据库文件路径
          logging: process.env.SQLITE_LOGGING === 'true' || false, // 是否打印SQL日志
        },

        mysql: {
          host: process.env.MYSQL_HOST || 'localhost',
          port: parseInt(process.env.MYSQL_PORT) || 3306,
          database: process.env.MYSQL_DATABASE || 'gopay',
          username: process.env.MYSQL_USERNAME || 'gopay',
          password: process.env.MYSQL_PASSWORD || 'gopay',
          charset: process.env.MYSQL_CHARSET || 'utf8mb4',
          collate: process.env.MYSQL_COLLATE || 'utf8mb4_unicode_ci',
          pool: {
            max: parseInt(process.env.MYSQL_POOL_MAX) || 5, // 连接池最大连接数
            min: parseInt(process.env.MYSQL_POOL_MIN) || 0, // 连接池最小连接数
            acquire: parseInt(process.env.MYSQL_POOL_ACQUIRE) || 30000, // 连接超时时间（毫秒）
            idle: parseInt(process.env.MYSQL_POOL_IDLE) || 10000, // 连接空闲时间（毫秒）
          },
          logging: process.env.MYSQL_LOGGING === 'true' || false, // 是否打印SQL日志
          ssl: process.env.MYSQL_SSL === 'true' || true, // 是否启用SSL
          sslOptions: {
            // SSL证书选项
            rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED === 'true' || false, // 是否拒绝未授权的证书
            // ca: fs.readFileSync('./cert/mysql-ca.pem') // 可选：CA证书
          },
          connectTimeout: parseInt(process.env.MYSQL_CONNECT_TIMEOUT) || 10000, // 连接超时时间（毫秒）
        },

        postgres: {
          host: process.env.POSTGRES_HOST || 'localhost',
          port: parseInt(process.env.POSTGRES_PORT) || 5432,
          database: process.env.POSTGRES_DATABASE || 'gopay',
          username: process.env.POSTGRES_USERNAME || 'gopay',
          password: process.env.POSTGRES_PASSWORD || 'gopay',
          pool: {
            max: parseInt(process.env.POSTGRES_POOL_MAX) || 5,
            min: parseInt(process.env.POSTGRES_POOL_MIN) || 0,
            acquire: parseInt(process.env.POSTGRES_POOL_ACQUIRE) || 30000,
            idle: parseInt(process.env.POSTGRES_POOL_IDLE) || 10000,
          },
          logging: process.env.POSTGRES_LOGGING === 'true' || false,
          ssl: process.env.POSTGRES_SSL === 'true' || true, // 是否启用SSL
          rejectUnauthorized: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED === 'true' || false, // 是否拒绝未授权的证书
          sslOptions: {
            // SSL证书选项
            // ca: fs.readFileSync('./cert/postgres-ca.pem') // 可选：CA证书
          },
        },

        mssql: {
          host: process.env.MSSQL_HOST || 'localhost',
          port: parseInt(process.env.MSSQL_PORT) || 1433,
          database: process.env.MSSQL_DATABASE || 'gopay',
          username: process.env.MSSQL_USERNAME || 'gopay',
          password: process.env.MSSQL_PASSWORD || 'gopay',
          pool: {
            max: parseInt(process.env.MSSQL_POOL_MAX) || 5,
            min: parseInt(process.env.MSSQL_POOL_MIN) || 0,
            acquire: parseInt(process.env.MSSQL_POOL_ACQUIRE) || 30000,
            idle: parseInt(process.env.MSSQL_POOL_IDLE) || 10000,
          },
          logging: process.env.MSSQL_LOGGING === 'true' || false,
          encrypt: process.env.MSSQL_ENCRYPT === 'true' || true, // 是否启用加密
          trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE === 'true' || true, // 是否信任服务器证书
          sslOptions: {
            // SSL证书选项
            // ca: fs.readFileSync('./cert/mssql-ca.pem') // 可选：CA证书
          },
        },

        mariadb: {
          host: process.env.MARIADB_HOST || 'localhost',
          port: parseInt(process.env.MARIADB_PORT) || 3306,
          database: process.env.MARIADB_DATABASE || 'gopay',
          username: process.env.MARIADB_USERNAME || 'gopay',
          password: process.env.MARIADB_PASSWORD || 'gopay',
          charset: process.env.MARIADB_CHARSET || 'utf8mb4',
          collate: process.env.MARIADB_COLLATE || 'utf8mb4_unicode_ci',
          pool: {
            max: parseInt(process.env.MARIADB_POOL_MAX) || 5,
            min: parseInt(process.env.MARIADB_POOL_MIN) || 0,
            acquire: parseInt(process.env.MARIADB_POOL_ACQUIRE) || 30000,
            idle: parseInt(process.env.MARIADB_POOL_IDLE) || 10000,
          },
          logging: process.env.MARIADB_LOGGING === 'true' || false,
          ssl: process.env.MARIADB_SSL === 'true' || true, // 是否启用SSL
          sslOptions: {
            // SSL证书选项
            rejectUnauthorized: process.env.MARIADB_SSL_REJECT_UNAUTHORIZED === 'true' || false,
            // ca: fs.readFileSync('./cert/mariadb-ca.pem') // 可选：CA证书
          },
          connectTimeout: parseInt(process.env.MARIADB_CONNECT_TIMEOUT) || 10000, // 连接超时时间（毫秒）
        },
      },
    },
  };
  
  // 验证配置
  validateConfig(config);
  
  return config;
};