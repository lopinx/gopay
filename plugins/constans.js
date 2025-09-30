const fp = require('fastify-plugin');

// 定义标准响应格式
const RESPONSE_FORMATS = {
  // 错误响应
  ERROR: (code, message) => ({
    code: code,
    msg: message
  }),
  
  // 成功响应
  SUCCESS: (message, data = {}) => ({
    code: 200,
    msg: message,
    data: data
  }),
  
  // 支付宝响应
  ALIPAY: {
    SUCCESS: 'success',
    FAIL: 'fail'
  },
  
  // 微信支付响应
  WXPAY: {
    SUCCESS: { code: 'SUCCESS', message: '成功' },
    FAIL: { code: 'FAIL', message: '失败' }
  }
};

module.exports = fp(async function (fastify, opts) {
  fastify.decorate('resp', {
    // 参数为空错误
    EMPTY_PARAMS: function (s) {
      return RESPONSE_FORMATS.ERROR(403, s + ' 参数不能为空');
    },
    
    // 签名错误
    SIGN_ERROR: RESPONSE_FORMATS.ERROR(403, '请求签名校验失败'),
    
    // PID错误
    PID_ERROR: RESPONSE_FORMATS.ERROR(403, 'PID不存在'),
    
    // 支付宝未配置
    ALIPAY_NO: RESPONSE_FORMATS.ERROR(400, '未配置 alipay 渠道信息'),
    
    // 系统错误
    SYS_ERROR: function (s) {
      return RESPONSE_FORMATS.ERROR(500, s);
    },
    
    // 支付宝错误
    ALIPAY_ERROR: RESPONSE_FORMATS.ERROR(404, '未获取到指定支付渠道信息'),
    
    // 支付宝成功响应
    ALIPAY_OK: RESPONSE_FORMATS.ALIPAY.SUCCESS,
    
    // 支付宝失败响应
    ALIPAY_FAIL: RESPONSE_FORMATS.ALIPAY.FAIL,
    
    // 通用成功响应
    RESP_OK: function (s, data = {}) {
      return RESPONSE_FORMATS.SUCCESS(s, data);
    },
    
    // 通用失败响应
    RESP_FAIL: function (code = 300, s, data = {}) {
      return RESPONSE_FORMATS.ERROR(code, s, data);
    },
    
    // 微信支付成功响应
    WXPAY_OK: RESPONSE_FORMATS.WXPAY.SUCCESS,
    
    // 微信支付失败响应
    WXPAY_FAIL: RESPONSE_FORMATS.WXPAY.FAIL,
  });
});