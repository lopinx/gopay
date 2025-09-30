const AlipaySdk = require('alipay-sdk').default;
// 新版本SDK中AlipayFormData的导入方式已更改
const AlipayFormData = require('alipay-sdk').AlipayFormData;
const fp = require('fastify-plugin');

const payCachePool = {};

class Alipay {
  alipaySdk = null;
  appId = '';

  constructor(appId, privateKey, alipayPublicKey) {
    // 检查必要参数是否为空
    if (!appId || !privateKey || !alipayPublicKey) {
      throw new Error('create Alipay err: missing required parameters');
    }
    
    // 验证参数格式
    if (typeof appId !== 'string' || appId.trim() === '') {
      throw new Error('create Alipay err: invalid appId');
    }
    
    if (typeof privateKey !== 'string' || privateKey.trim() === '') {
      throw new Error('create Alipay err: invalid privateKey');
    }
    
    if (typeof alipayPublicKey !== 'string' || alipayPublicKey.trim() === '') {
      throw new Error('create Alipay err: invalid alipayPublicKey');
    }
    
    if (payCachePool[appId] !== undefined) {
      // 取缓存
      this.alipaySdk = payCachePool[appId];
    } else {
      try {
        this.alipaySdk = new AlipaySdk({
          /** 支付宝网关 **/
          gateway: 'https://openapi.alipay.com/gateway.do',
          appId: (this.appId = appId),
          privateKey: privateKey,
          alipayPublicKey: alipayPublicKey,
          signType: 'RSA2',
        });

        payCachePool[appId] = this.alipaySdk;
      } catch (error) {
        throw new Error(`Failed to initialize Alipay SDK: ${error.message}`);
      }
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
    try {
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
    } catch (error) {
      throw new Error(`Alipay exec failed: ${error.message}`);
    }
  }
  
  // 添加新版本SDK的签名验证方法
  checkNotifySign(params) {
    try {
      return this.alipaySdk.checkNotifySign(params);
    } catch (error) {
      throw new Error(`Alipay signature verification failed: ${error.message}`);
    }
  }
}

module.exports = fp(async function (fastify, opts) {
  fastify.decorate('alipay', {
    newInstance: function (appId = '') {
      try {
        // 检查支付宝配置是否存在
        if (!opts.alipay || opts.alipay.length === 0) {
          fastify.log.info('支付宝配置为空，不启用支付宝支付');
          return null;
        }
        
        // 过滤掉appid为空的配置
        const validAlipayConfigs = opts.alipay.filter(config => config.appId && config.appId.trim() !== '');
        
        // 如果没有有效的配置，不启用支付宝支付
        if (validAlipayConfigs.length === 0) {
          fastify.log.info('没有有效的支付宝配置，不启用支付宝支付');
          return null;
        }
        
        let len = validAlipayConfigs.length;
        
        if (appId !== '') {
          let temp_i = -1;
          for (let i = 0; i < len; i++) {
            if (validAlipayConfigs[i].appId === appId) {
              temp_i = i;
              break;
            }
          }
          if (temp_i !== -1) {
            let alipayc = validAlipayConfigs[temp_i];
            // 注意：这里返回的是Alipay实例，而不是.alipaySdk
            return new Alipay(
              alipayc.appId,
              alipayc.privateKey,
              alipayc.alipayPublicKey
            );
          } else {
            fastify.log.warn(`指定的支付宝appId ${appId} 未找到`);
            return null;
          }
        }

        let alipayindex = Math.floor(Math.random() * len);
        let alipayc = validAlipayConfigs[alipayindex];

        fastify.log.info('随机使用 Alipay : ' + alipayindex);
        fastify.log.debug('使用的支付宝配置:', alipayc);

        return new Alipay(
          alipayc.appId,
          alipayc.privateKey,
          alipayc.alipayPublicKey
        );
      } catch (error) {
        fastify.log.error('创建支付宝实例失败:', error.message);
        return null;
      }
    },
  });
});