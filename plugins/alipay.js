const AlipaySdk = require('alipay-sdk').default;
const AlipayFormData = require('alipay-sdk/lib/form').default;
const fp = require('fastify-plugin');

const payCachePool = {};

class Alipay {
  alipaySdk = null;
  appId = '';

  constructor(appId, privateKey, alipayPublicKey) {
    if (!appId || !privateKey || !alipayPublicKey) {
      throw 'create Alipay err';
    }
    if (payCachePool[appId] !== undefined) {
      // 取缓存
      this.alipaySdk = payCachePool[appId];
    } else {
      this.alipaySdk = new AlipaySdk({
        /** 支付宝网关 **/
        gateway: 'https://openapi.alipay.com/gateway.do',
        appId: (this.appId = appId),
        privateKey: privateKey,
        alipayPublicKey: alipayPublicKey,
        signType: 'RSA2',
      });

      payCachePool[appId] = this.alipaySdk;
    }
  }

  exec(
    outTradeNo,
    totalAmount,
    subject,
    body,
    agent = 'page',
    notifyUrl = '',
    returnUrl = ''
  ) {
    let formData = new AlipayFormData();
    formData.setMethod('get');
    if (notifyUrl) {
      formData.addField('notify_url', notifyUrl);
    }
    if (returnUrl) {
      formData.addField('return_url', returnUrl);
    }

    formData.addField('bizContent', {
      outTradeNo: outTradeNo, // 订单号
      productCode: 'FAST_INSTANT_TRADE_PAY', // 常量不需要修改
      totalAmount: totalAmount,
      subject: subject,
      body: body,
    });

    return this.alipaySdk.exec(
      'alipay.trade.' + agent + '.pay',
      {},
      {
        formData: formData,
      },
      { validateSign: true }
    );
  }
}

module.exports = fp(async function (fastify, opts) {
  fastify.decorate('alipay', {
    newInstance: function (appId = '') {
      let len = 0;
      if (opts.alipay && (len = opts.alipay.length) > 0) {
        if (appId !== '') {
          let temp_i = -1;
          for (let i = 0; i < len; i++) {
            if (opts.alipay[i].appId === appId) {
              temp_i = i;
              break;
            }
          }
          if (temp_i !== -1) {
            let alipayc = opts.alipay[temp_i];
            return new Alipay(
              alipayc.appId,
              alipayc.privateKey,
              alipayc.alipayPublicKey
            ).alipaySdk;
          } else {
            return null;
          }
        }

        let alipayindex = Math.floor(Math.random() * len);
        let alipayc = opts.alipay[alipayindex];

        fastify.log.info('随机使用 Alipay : ' + alipayindex);
        fastify.log.info(alipayc);

        return new Alipay(
          alipayc.appId,
          alipayc.privateKey,
          alipayc.alipayPublicKey
        );
      } else {
        return null;
      }
    },
  });
});
