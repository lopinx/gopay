const stringUtils = require('../../../utils/stringutils')
const epayUtils = require('../../../utils/epayutils')
const { crypto } = require('wechatpay-node-v3');
const tag_notify = 'wxpay_notify';

async function notifyWithRetry(fastify, url, appid, out_trade_no, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const { status } = await fastify.axios.get(url);
      if (status >= 200 && status < 500) {
        fastify.log.info(tag_notify + ' 通知成功, appId:' + appid + ", out_trade_no:" + out_trade_no);
        return true;
      }
    } catch (e) {
      fastify.log.error(tag_notify + ' 通知失败 (attempt ' + (i + 1) + '/' + maxRetries + '), appId:' + appid + ", out_trade_no:" + out_trade_no);
    }
    if (i < maxRetries - 1) {
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  return false;
}

module.exports = async function (fastify, opts) {

  fastify.post('/pay/wxpay_notify/:appid', async function (request, reply) {

    let event_type = request.body['event_type']
    let appid = request.params.appid;

    if (event_type !== 'TRANSACTION.SUCCESS') {
      return fastify.resp.EMPTY_PARAMS('TRANSACTION.SUCCESS')
    }
    let wxpay = fastify.wxpay.newInstance(appid)
    if (wxpay == null) {
      return reply.code(402).send('appid NotFound')
    }

    let secret = wxpay.getSecret();
    if (!secret) {
      return reply.code(403).send('serial NotFound')
    }

    try {
      const decryptJson = crypto.aes256gcm.decrypt(
        request.body.resource.ciphertext,
        request.body.resource.associated_data,
        request.body.resource.nonce,
        secret
      );

      let data = JSON.parse(decryptJson)

      let out_trade_no = data.out_trade_no
      let order = await fastify.db.models.Order.findOne({
        where: {
          id: out_trade_no
        }
      })
      if (order == null) {
        return reply.code(404).send('order NotFound')
      }

    if (data.trade_state === 'SUCCESS') {
      const [affectedRows] = await fastify.db.models.Order.update(
        { status: 1 },
        { where: { id: out_trade_no, status: 0 } }
      );

      if (affectedRows === 0 && order['status'] !== 1) {
        fastify.log.warn(tag_notify + ' 订单状态更新失败，可能已被处理, appId:' + appid + ", out_trade_no:" + out_trade_no);
      }

      let pid = order['pid']
      let user = fastify.user.getUser(pid)
      if (user == null) {
        return fastify.resp.SYS_ERROR('PID不存在，无法查询，请以实际到账为准')
      }

      let order_notify_url = epayUtils.buildPayNotifyCallbackUrl(order, order.id, user.key)

      fastify.log.info('order_notify_url：' + order_notify_url)
      const notifyResult = await notifyWithRetry(fastify, order_notify_url, appid, out_trade_no);
      if (notifyResult) {
        return fastify.resp.WXPAY_OK
      } else {
        return fastify.resp.WXPAY_FAIL
      }

    }

      fastify.log.info('trade_state: ' + data.trade_state)

    } catch (e) {
      fastify.log.info(tag_notify + ' 解密微信回调数据错误')
      fastify.log.info(e)
    }

    return fastify.resp.WXPAY_FAIL;
  })

}
