module.exports = async function (fastify, opts) {
  /**
   * native 扫码支付
   */
  fastify.get('/pay/wxpay/native', async function (request, reply) {
    try {
      let cr = request.query['cr'];
      let out_trade_no = request.query['out_trade_no']; // 订单 uuid
      let useragent = request.query['ua'];

      // 参数验证
      if (!cr) {
        fastify.log.warn('wxpay/native: 缺少cr参数');
        return fastify.resp.SYS_ERROR('缺少必要的支付参数');
      }

      if (!out_trade_no) {
        fastify.log.warn('wxpay/native: 缺少out_trade_no参数');
        return fastify.resp.SYS_ERROR('缺少订单号参数');
      }

      // 解码URL
      let decodedUrl;
      try {
        decodedUrl = Buffer.from(cr, 'base64').toString('utf-8');
      } catch (decodeError) {
        fastify.log.error('wxpay/native: 解码支付URL失败: ' + decodeError.message);
        return fastify.resp.SYS_ERROR('支付参数解析失败');
      }

      let ejsData = {
        out_trade_no: out_trade_no,
        url: decodedUrl,
      };
      
      if (useragent !== 'mobile') {
        // 查询订单信息
        let order = await fastify.db.models.Order.findOne({
          where: {
            id: out_trade_no,
          },
        });
        if (order === null) {
          fastify.log.warn('wxpay/native: 订单不存在, out_trade_no: ' + out_trade_no);
          return fastify.resp.SYS_ERROR('当前订单不存在');
        }
        ejsData['order'] = order;
      }

      return reply.view(
        '/templates/wechat/' +
          (useragent === 'mobile' ? 'm_' : 'pc_') +
          'native_pay.ejs',
        ejsData
      );
    } catch (error) {
      fastify.log.error('wxpay/native: 处理扫码支付请求时发生错误: ' + error.message);
      fastify.log.error(error);
      return fastify.resp.SYS_ERROR('系统错误，请稍后重试');
    }
  });
};