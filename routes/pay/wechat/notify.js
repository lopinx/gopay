const stringUtils = require('../../../utils/stringutils');
const epayUtils = require('../../../utils/epayutils');
const aes = require('wechatpay-axios-plugin/lib/aes');
const tag_notify = 'wxpay_notify';

module.exports = async function (fastify, opts) {
  fastify.post('/pay/wxpay_notify/:appid', async function (request, reply) {
    let event_type = request.body['event_type'];
    let appid = request.params.appid;

    if (event_type !== 'TRANSACTION.SUCCESS') {
      // 拦截不成功的通知
      return fastify.resp.EMPTY_PARAMS('TRANSACTION.SUCCESS');
    }
    let wxpay = fastify.wxpay.newInstance(appid);
    if (wxpay == null) {
      return reply.code(402).send('appid NotFound');
    }

    let secret = wxpay.getSecret();
    if (!secret) {
      return reply.code(403).send('serial NotFound');
    }

    try {
      const decryptJson = aes.decrypt(
        request.body.resource.nonce,
        secret,
        request.body.resource.ciphertext,
        request.body.resource.associated_data
      );

      let data = JSON.parse(decryptJson);

      let out_trade_no = data.out_trade_no;
      let order = await fastify.db.models.Order.findOne({
        where: {
          id: out_trade_no,
        },
      });
      if (order == null) {
        return reply.code(404).send('order NotFound');
      }

      if (data.trade_state === 'SUCCESS') {
        if (order['status'] === 0) {
          order['status'] = 1;
          await order.save();
        }

        // 回调通知源网站接口
        let pid = order['pid'];
        let user = fastify.user.getUser(pid);
        if (user == null) {
          return fastify.resp.SYS_ERROR(
            'PID不存在，无法查询，请以实际到账为准'
          );
        }

        let order_notify_url = epayUtils.buildPayNotifyCallbackUrl(
          order,
          order.id,
          user.key
        );

        console.log('order_notify_url：' + order_notify_url);
        // 发起 http 通知，重试 3 次
        const { data, status } = await fastify.axios.get(order_notify_url);
        if (status >= 200 && status < 500) {
          fastify.log.info(
            tag_notify +
              ' GET ' +
              data +
              ', appId:' +
              appid +
              ', out_trade_no:' +
              out_trade_no
          );

          return fastify.resp.WXPAY_OK;
        } else {
          //
          fastify.log.info(
            tag_notify +
              ' 通知源服务器失败, appId:' +
              appid +
              ', out_trade_no:' +
              out_trade_no
          );
          return fastify.resp.WXPAY_FAIL;
        }
      }

      console.log(data.trade_state);
    } catch (e) {
      fastify.log.info(tag_notify + ' 解密微信回调数据错误');
      fastify.log.info(e);
    }

    return fastify.resp.WXPAY_FAIL;
  });
};
