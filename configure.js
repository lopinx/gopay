const fs = require('fs')
module.exports = {

    web: {
        // 支付域名，用于回调通知，结尾不加 /
        payUrl: 'https://pay.xxxx.com'
    },

    user: {
        '10001': {
            key: 'XM9b0ce7BE6R9NQ897B0wW0LW031B182'
        }
    },
    alipay: [
        {
            appId: '2020001169673295',
            // 应用私钥
            privateKey: '',
            // 支付宝公钥
            alipayPublicKey: ''
        }
    ],
    wxpay: [

        {
            appId: '',
            mchid: '',
            privateKey: fs.readFileSync('./cert/wxpay/apiclient_key.pem'), // 微信官网通过工具生成的证书 私钥
            serial: '4034C472D3C81CCA157C5837B7186E366886EA75', // 官网生成证书后，再点击即可显示 证书序列号
            secret: '', // v2版 32位密钥 ,官网自己设置的
            certs: {
                /*
                    参数说明
                    cd gopay
                    npm install yargs
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
                 */
                '36736A4D01F0056B033693E40B6DB995D2A9B6D1': fs.readFileSync('./cert/wxpay/wechatpay_36736A4D01F0056B033693E40B6DB995D2A9B6D1.pem'),
            },
            only_native: false // 是否开启仅扫码 , 如果是在手机上就需要另一个手机扫码，保存相册的native二维码是无法支付的
        }
    ],

    /**
     * 替换源网站至支付宝\微信的订单名称
     */
    form: {
        subject: {
            rewrite: true,
            text: ['个性手机壳', '蓝牙耳机', 'OPPO原装数据线', '通用1A充电器', '品胜充电宝', '安卓通用耳机']
        },
        body: {
            rewrite: true,
            text: '投诉请联系QQ123456'
        }
    },

    db: {
        mysql: {
            host: '127.0.0.1',
            database: 'gopay',
            username: '',
            password: '',
            pool: {
                max: 5,
                min: 1,
                acquire: 30000,
                idle: 10000
            },
            logging: false
        }
    }


}