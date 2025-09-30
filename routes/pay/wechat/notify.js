const stringUtils = require('../../../utils/stringutils');
const epayUtils = require('../../../utils/epayutils');
const tag_notify = 'wxpay_notify';

module.exports = async function (fastify, opts) {
  fastify.post('/pay/wxpay_notify/:appid', async function (request, reply) {
    try {
      let event_type = request.body['event_type'];
      let appid = request.params.appid;

      // 验证必要参数
      if (!event_type) {
        fastify.log.warn(tag_notify + ' 缺少事件类型参数');
        return reply.code(400).send('缺少事件类型参数');
      }

      if (!appid) {
        fastify.log.warn(tag_notify + ' 缺少appid参数');
        return reply.code(400).send('缺少appid参数');
      }

      if (event_type !== 'TRANSACTION.SUCCESS') {
        // 拦截不成功的通知
        fastify.log.info(tag_notify + ' 收到非成功交易通知: ' + event_type);
        return reply.code(200).send({ code: 'SUCCESS', message: '成功' });
      }
      
      let wxpay = fastify.wxpay.newInstance(appid);
      if (wxpay == null) {
        fastify.log.error(tag_notify + ' 未找到appid对应的微信支付配置: ' + appid);
        return reply.code(402).send('appid NotFound');
      }

      // 验证签名
      const verified = await wxpay.verifySignature(request.headers, request.body);
      if (!verified) {
        fastify.log.error(tag_notify + ' 签名验证失败, appid: ' + appid);
        return reply.code(401).send('签名验证失败');
      }

      try {
        // 解密回调数据
        const resource = request.body.resource;
        if (!resource) {
          fastify.log.error(tag_notify + ' 缺少resource数据, appid: ' + appid);
          return reply.code(400).send('缺少resource数据');
        }

        const decryptJson = await wxpay.decryptNotifyData(
          resource.associated_data,
          resource.nonce,
          resource.ciphertext
        );

        let data = JSON.parse(decryptJson);
        fastify.log.info(tag_notify + ' 解密回调数据成功, appid: ' + appid + ', out_trade_no: ' + data.out_trade_no);

        let out_trade_no = data.out_trade_no;
        if (!out_trade_no) {
          fastify.log.error(tag_notify + ' 缺少out_trade_no参数, appid: ' + appid);
          return reply.code(400).send('缺少out_trade_no参数');
        }

        let order = await fastify.db.models.Order.findOne({
          where: {
            id: out_trade_no,
          },
        });
        if (order == null) {
          fastify.log.error(tag_notify + ' 未找到订单, out_trade_no: ' + out_trade_no);
          return reply.code(404).send('order NotFound');
        }

        if (data.trade_state === 'SUCCESS') {
          if (order['status'] === 0) {
            order['status'] = 1;
            await order.save();
            fastify.log.info(tag_notify + ' 订单状态更新成功, out_trade_no: ' + out_trade_no);
          }

          // 回调通知源网站接口
          let pid = order['pid'];
          let user = fastify.user.getUser(pid);
          if (user == null) {
            fastify.log.error(tag_notify + ' PID不存在，无法查询，请以实际到账为准, pid: ' + pid);
            return reply.code(200).send({ code: 'SUCCESS', message: '成功' }); // 仍然返回成功给微信
          }

          let order_notify_url = epayUtils.buildPayNotifyCallbackUrl(
            order,
            order.id,
            user.key
          );

          fastify.log.info(tag_notify + ' 准备通知源网站, url: ' + order_notify_url);
          // 发起 http 通知，重试 3 次
          try {
            const { data: responseData, status } = await fastify.axios.get(order_notify_url);
            if (status >= 200 && status < 500) {
              fastify.log.info(
                tag_notify +
                  ' GET 通知源网站成功, status: ' + status +
                  ', response: ' + responseData +
                  ', appId:' + appid +
                  ', out_trade_no:' + out_trade_no
              );

              return reply.code(200).send({ code: 'SUCCESS', message: '成功' });
            } else {
              fastify.log.warn(
                tag_notify +
                  ' 通知源服务器失败, status: ' + status +
                  ', appId:' + appid +
                  ', out_trade_no:' + out_trade_no
              );
              // 即使通知失败，也返回成功给微信，避免重复通知
              return reply.code(200).send({ code: 'SUCCESS', message: '成功' });
            }
          } catch (axiosError) {
            fastify.log.error(
              tag_notify +
                ' 通知源网站时发生网络错误: ' + axiosError.message +
                ', appId:' + appid +
                ', out_trade_no:' + out_trade_no
            );
            // 即使通知失败，也返回成功给微信，避免重复通知
            return reply.code(200).send({ code: 'SUCCESS', message: '成功' });
          }
        } else {
          fastify.log.info(tag_notify + ' 交易状态非SUCCESS: ' + data.trade_state + ', out_trade_no: ' + out_trade_no);
        }
      } catch (decryptError) {
        fastify.log.error(tag_notify + ' 解密微信回调数据错误: ' + decryptError.message);
        fastify.log.error(decryptError);
        return reply.code(500).send('解密回调数据错误');
      }
    } catch (error) {
      fastify.log.error(tag_notify + ' 处理微信支付回调时发生错误: ' + error.message);
      fastify.log.error(error);
      // 发生未处理的错误时，返回成功给微信，避免重复通知
      return reply.code(200).send({ code: 'SUCCESS', message: '成功' });
    }

    return reply.code(200).send({ code: 'SUCCESS', message: '成功' });
  });
};