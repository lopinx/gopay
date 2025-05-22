const fp = require('fastify-plugin');
module.exports = fp(async function (fastify, opts) {
  fastify.decorate('resp', {
    EMPTY_PARAMS: function (s) {
      return { code: 403, msg: s + ' 参数不能为空' };
    },
    SIGN_ERROR: { code: 403, msg: '请求签名校验失败' },
    PID_ERROR: { code: 403, msg: 'PID不存在' },
    ALIPAY_NO: { code: 400, msg: '未配置 alipay 渠道信息' },
    SYS_ERROR: function (s) {
      return { code: 500, msg: s };
    },
    ALIPAY_ERROR: { code: 404, msg: '未获取到指定支付渠道信息' },
    ALIPAY_OK: 'success',
    ALIPAY_FAIL: 'fail',
    RESP_OK: function (s, data = {}) {
      return { code: 200, msg: s, data: data };
    },
    RESP_FAIL: function (code = 300, s, data = {}) {
      return { code: code, msg: s, data: data };
    },
    WXPAY_OK: { code: 'SUCCESS', message: '成功' },
    WXPAY_FAIL: { code: 'FAIL', message: '失败' },
  });
});
