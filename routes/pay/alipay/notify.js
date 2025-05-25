const stringUtils = require('../../../utils/stringutils');
const epayUtils = require('../../../utils/epayutils');

const tag_notify = 'alipay_notify';
const tag_return = 'alipay_return';

module.exports = async function (fastify, opts) {
  fastify.post('/pay/alipay_notify', async function (request, reply) {
    let appId = request.body['app_id'];
    let out_trade_no = request.body['out_trade_no'];
    if (stringUtils.isEmpty(appId) || stringUtils.isEmpty(out_trade_no)) {
      fastify.log.info(
        tag_notify +
          ' 参数为空, appId:' +
          appId +
          ', out_trade_no:' +
          out_trade_no
      );
      return fastify.resp.ALIPAY_FAIL;
    }

    let alipay = fastify.alipay.newInstance(appId);
    if (alipay === null) {
      fastify.log.info(
        tag_notify +
          ' 同步回调失败, 获取AliSdk失败, appId:' +
          appId +
          ', out_trade_no:' +
          out_trade_no
      );
      return fastify.resp.ALIPAY_FAIL;
    }
    const verify = alipay.checkNotifySign(request.body);
    if (verify) {
      //校验支付宝签名成功
      let trade_no = request.body['trade_no']; //支付宝生成的订单号
      let trade_status = request.body['trade_status'];

      if (trade_status === 'TRADE_FINISHED') {
        //退款日期超过可退款期限后（如三个月可退款），支付宝系统发送该交易状态通知
        return fastify.resp.ALIPAY_OK;
      }

      let sequelize = fastify.db;
      let order = await sequelize.models.Order.findOne({
        where: {
          out_trade_no: out_trade_no,
        },
      });
      if (order == null) {
        //未找到订单
        fastify.log.info(
          tag_notify +
            ' 支付成功, 但是未找到订单信息 , appId:' +
            appId +
            ', out_trade_no:' +
            out_trade_no
        );
        return fastify.resp.ALIPAY_FAIL;
      }
      if (trade_status === 'TRADE_SUCCESS') {
        //支付成功
        if (order['status'] !== 1) {
          order['status'] = 1;
          // 更新状态
          await order.save();
        }
        if (order.status !== 1) {
          fastify.log.info(
            tag_notify +
              ' 支付成功, 但是更新订单信息失败 , appId:' +
              appId +
              ', out_trade_no:' +
              out_trade_no
          );
        }

        let pid = order['pid'];
        let user = fastify.user.getUser(pid);
        if (user == null) {
          fastify.log.info(
            tag_notify +
              ' 支付成功, 但是未找到PID , appId:' +
              appId +
              ', out_trade_no:' +
              out_trade_no
          );
          return fastify.resp.ALIPAY_FAIL;
        }
        // 构建源站通知 url

        let order_notify_url = epayUtils.buildPayNotifyCallbackUrl(
          order,
          trade_no,
          user.key
        );

        console.log('order_notify_url：' + order_notify_url);
        // 发起 http 通知，重试 2 次
        const { data, status } = await fastify.axios.get(order_notify_url);
        if (status >= 200 && status < 500) {
          fastify.log.info(
            tag_notify +
              ' GET ' +
              data +
              ', appId:' +
              appId +
              ', out_trade_no:' +
              out_trade_no
          );
          return data;
        } else {
          //
          fastify.log.info(
            tag_notify +
              ' 通知源服务器失败, appId:' +
              appId +
              ', out_trade_no:' +
              out_trade_no
          );
          return fastify.resp.ALIPAY_FAIL;
        }
      }

      return fastify.resp.ALIPAY_OK;
    } else {
      fastify.log.info(
        tag_notify +
          ' 校验支付宝签名失败, appId:' +
          appId +
          ', out_trade_no:' +
          out_trade_no
      );
      return fastify.resp.SIGN_ERROR;
    }
  });

  fastify.get('/pay/alipay_return', async function (request, reply) {
    let appId = request.query['app_id'];
    let out_trade_no = request.query['out_trade_no'];
    if (stringUtils.isEmpty(appId) || stringUtils.isEmpty(out_trade_no)) {
      fastify.log.info(
        tag_return +
          ' 参数为空, appId:' +
          appId +
          ', out_trade_no:' +
          out_trade_no
      );
      return fastify.resp.EMPTY_PARAMS('app_id/out_trade_no');
    }

    let alipay = fastify.alipay.newInstance(appId);
    if (alipay === null) {
      fastify.log.info(
        tag_return +
          ' 同步回调失败, 获取AliSdk失败, appId:' +
          appId +
          ', out_trade_no:' +
          out_trade_no
      );
      return fastify.resp.ALIPAY_ERROR;
    }
    const verify = alipay.checkNotifySign(request.query);
    if (verify) {
      //校验支付宝签名成功，支付宝回调理论上肯定是已支付过的
      let trade_no = request.query['trade_no']; //支付宝的订单号
      let sequelize = fastify.db;
      let order = await sequelize.models.Order.findOne({
        where: {
          out_trade_no: out_trade_no,
        },
      });
      if (order == null) {
        //未找到订单
        fastify.log.info(
          tag_return +
            ' 支付成功, 但是未找到订单信息 , appId:' +
            appId +
            ', out_trade_no:' +
            out_trade_no
        );
        return fastify.resp.SYS_ERROR(
          '支付成功, 但是发生订单不同步错误, 未找到该订单信息, 请联系卖家客服, appId : ' +
            appId +
            'out_trade_no : ' +
            out_trade_no
        );
      }
      if (order['status'] !== 1) {
        order['status'] = 1;
        // 更新状态
        await order.save();
      }

      if (order.status !== 1) {
        fastify.log.info(
          tag_return +
            ' 支付成功, 但是更新订单信息失败 , appId:' +
            appId +
            ', out_trade_no:' +
            out_trade_no
        );
      }

      let pid = order['pid'];

      // 构建返回url
      let user = fastify.user.getUser(pid);
      if (user == null) {
        fastify.log.info(
          tag_return +
            ' 支付成功, 但是未找到PID , appId:' +
            appId +
            ', out_trade_no:' +
            out_trade_no
        );
        return fastify.resp.SYS_ERROR(
          '支付成功, 但是未找到PID, 请联系卖家客服, appId : ' +
            appId +
            'out_trade_no : ' +
            out_trade_no
        );
      }

      let order_return_url = epayUtils.buildPayReturnCallbackUrl(
        order,
        trade_no,
        user.key
      );

      return reply.view('/templates/jump.ejs', {
        return_url: order_return_url,
      });
    } else {
      fastify.log.info(
        tag_return +
          ' 校验支付宝签名失败, appId:' +
          appId +
          ', out_trade_no:' +
          out_trade_no
      );
      return fastify.resp.SIGN_ERROR;
    }
  });
};
