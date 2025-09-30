const fp = require('fastify-plugin');
// 使用新的微信支付SDK
const WechatPay = require('wechatpay-node-v3');
const fs = require('fs');

// sdk 缓存池
const payCachePool = {};

class Wxpay {
  constructor(opts) {
    this.wxpaysdk = null;
    this.appid = '';
    this.mchid = '';
    this.secret = '';
    this.only_native = false;
    
    // 检查必要参数
    if (!opts.appId || !opts.mchid || !opts.privateKey || !opts.secret) {
      throw new Error('create Wxpay err: missing required parameters');
    }
    
    // 验证参数格式
    if (typeof opts.appId !== 'string' || opts.appId.trim() === '') {
      throw new Error('create Wxpay err: invalid appId');
    }
    
    if (typeof opts.mchid !== 'string' || opts.mchid.trim() === '') {
      throw new Error('create Wxpay err: invalid mchid');
    }
    
    if (typeof opts.secret !== 'string' || opts.secret.trim() === '') {
      throw new Error('create Wxpay err: invalid secret');
    }
    
    // 验证证书参数
    if (!opts.certs || Object.keys(opts.certs).length === 0) {
      throw new Error('create Wxpay err: missing certificates');
    }
    
    this.appid = opts.appId;
    this.mchid = opts.mchid;
    this.secret = opts.secret;
    this.only_native = opts.only_native || false;

    if (payCachePool[opts.appId] !== undefined) {
      // 取缓存
      this.wxpaysdk = payCachePool[opts.appId];
    } else {
      try {
        // 使用新的SDK初始化方式
        this.wxpaysdk = new WechatPay({
          appid: opts.appId,
          mchid: opts.mchid,
          publicKey: Object.values(opts.certs)[0], // 取第一个证书
          privateKey: opts.privateKey,
          serial: opts.serial,
          secret: opts.secret
        });

        payCachePool[opts.appId] = this.wxpaysdk;
      } catch (error) {
        throw new Error(`Failed to initialize WeChat Pay SDK: ${error.message}`);
      }
    }
  }

  getAppid() {
    return this.appid;
  }

  getSecret() {
    return this.secret;
  }

  isOnlyNavtive() {
    return this.only_native;
  }

  /**
   *
   * @param type
   * @param data
   * @returns {{amount: {total: (number|{jsMemoryEstimate: number, jsMemoryRange: [number, number]}|PaymentItem), currency: string}, mchid: (string|string), out_trade_no: (string|string), appid: *, description: (*|string), notify_url: StringDataTypeConstructor | string}|null|{amount: {total: (number|{jsMemoryEstimate: number, jsMemoryRange: [number, number]}|PaymentItem), currency: string}, mchid: any, out_trade_no: (string|string), appid: *, description: (*|string), attach: string, notify_url: StringDataTypeConstructor | string, scene_info: {h5_info: {app_name: string, app_url: string, type: string}, payer_client_ip: string}}}
   */
  formData(type, data) {
    try {
      // 验证必要参数
      if (!data || !data.out_trade_no || !data.total) {
        throw new Error('Missing required parameters: out_trade_no or total');
      }
      
      if (this.only_native) {
        type = 'native';
        // 当前渠道强制使用扫码
      }
      
      const result = {
        description: data.description ? data.description : '',
        out_trade_no: data.out_trade_no,
        amount: {
          total: parseInt(data.total),
          currency: 'CNY',
        },
        notify_url: data.notify_url,
      };
      
      if (type === 'h5') {
        if (!data.payer_client_ip) {
          throw new Error('Missing required parameter: payer_client_ip for H5 payment');
        }
        
        result.scene_info = {
          payer_client_ip: data.payer_client_ip,
          h5_info: {
            type: 'Wap',
            app_name: 'GOPAY',
            app_url: 'https://pay.gopay.com',
          }
        };
      }
      
      return result;
    } catch (error) {
      throw new Error(`WeChat Pay form data generation failed: ${error.message}`);
    }
  }

  async exec(formData) {
    if (formData === null) {
      throw new Error('wxpay form is Null');
    }
    
    try {
      // 根据scene_info判断是H5还是Native支付
      if (formData.scene_info) {
        // h5支付
        return await this.wxpaysdk.transactions_h5(formData);
      } else {
        // native支付
        return await this.wxpaysdk.transactions_native(formData);
      }
    } catch (error) {
      throw new Error(`WeChat Pay execution failed: ${error.message}`);
    }
  }
  
  // 添加验证通知签名的方法
  async verifySignature(headers, body) {
    try {
      return await this.wxpaysdk.verifySign(headers, body);
    } catch (err) {
      return false;
    }
  }
  
  // 解密回调数据的方法
  async decryptNotifyData(associated_data, nonce, ciphertext) {
    try {
      return await this.wxpaysdk.decipher_gcm(ciphertext, associated_data, nonce, this.secret);
    } catch (error) {
      throw new Error(`WeChat Pay decrypt notification data failed: ${error.message}`);
    }
  }
}

module.exports = fp(async function (fastify, opts) {
  fastify.decorate('wxpay', {
    newInstance: function (appId = '') {
      try {
        // 检查微信支付配置是否存在
        if (!opts.wxpay || opts.wxpay.length === 0) {
          fastify.log.info('微信支付配置为空，不启用微信支付');
          return null;
        }
        
        // 过滤掉appid为空的配置
        const validWxpayConfigs = opts.wxpay.filter(config => config.appId && config.appId.trim() !== '');
        
        // 如果没有有效的配置，不启用微信支付
        if (validWxpayConfigs.length === 0) {
          fastify.log.info('没有有效的微信支付配置，不启用微信支付');
          return null;
        }
        
        let len = validWxpayConfigs.length;
        
        if (appId !== '') {
          let temp_i = -1;
          for (let i = 0; i < len; i++) {
            if (validWxpayConfigs[i].appId === appId) {
              temp_i = i;
              break;
            }
          }
          if (temp_i !== -1) {
            let wxpayc = validWxpayConfigs[temp_i];

            return new Wxpay({
              appId: wxpayc.appId,
              mchid: wxpayc.mchid,
              serial: wxpayc.serial,
              privateKey: wxpayc.privateKey,
              certs: wxpayc.certs,
              secret: wxpayc.secret,
              only_native: wxpayc.only_native,
            });
          } else {
            fastify.log.warn(`指定的微信支付appId ${appId} 未找到`);
            return null;
          }
        }

        let wxpayindex = Math.floor(Math.random() * len);
        let wxpayc = validWxpayConfigs[wxpayindex];

        fastify.log.info('随机使用 Wxpay : ' + wxpayindex);
        fastify.log.debug('使用的微信支付配置:', wxpayc);

        return new Wxpay({
          appId: wxpayc.appId,
          mchid: wxpayc.mchid,
          serial: wxpayc.serial,
          privateKey: wxpayc.privateKey,
          certs: wxpayc.certs,
          secret: wxpayc.secret,
          only_native: wxpayc.only_native,
        });
      } catch (error) {
        fastify.log.error('创建微信支付实例失败:', error.message);
        return null;
      }
    },
  });
});