const epayUtils = require("../../../utils/epayutils");

const tag_return = "paypal_return";

async function notifyWithRetry(fastify, url, clientId, outTradeNo, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const { status } = await fastify.axios.get(url);
      if (status >= 200 && status < 500) {
        fastify.log.info(
          tag_return + " 通知成功, clientId:" + clientId + ", out_trade_no:" + outTradeNo
        );
        return true;
      }
    } catch (e) {
      fastify.log.error(
        tag_return +
          " 通知失败 (attempt " +
          (i + 1) +
          "/" +
          maxRetries +
          "), clientId:" +
          clientId +
          ", out_trade_no:" +
          outTradeNo
      );
    }
    if (i < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  return false;
}

module.exports = async function (fastify, opts) {
  fastify.get("/pay/paypal_return", async function (request, reply) {
    const token = request.query.token;
    const invoiceId = request.query.invoiceId;

    if (!token || !invoiceId) {
      fastify.log.warn(tag_return + " 缺少参数");
      return reply.redirect("/");
    }

    const order = await fastify.db.models.Order.findOne({
      where: {
        out_trade_no: invoiceId,
        type: "paypal",
      },
    });

    if (!order) {
      fastify.log.warn(tag_return + " 订单不存在: " + invoiceId);
      return reply.redirect("/");
    }

    if (order.status === 1) {
      fastify.log.info(tag_return + " 订单已支付: " + invoiceId);
      return reply.redirect(order.return_url);
    }

    try {
      // 使用订单中保存的特定 clientId
      const paypal = fastify.paypal.newInstance(order.attach);
      if (!paypal) {
        fastify.log.error(tag_return + " PayPal 未配置");
        return reply.redirect(order.return_url);
      }

      const captureResult = await paypal.captureOrder(token);

      if (captureResult.status !== "COMPLETED") {
        fastify.log.warn(tag_return + " 订单未完成: " + captureResult.status);
        return reply.redirect(order.return_url);
      }

      const [affectedRows] = await fastify.db.models.Order.update(
        { status: 1 },
        {
          where: {
            out_trade_no: invoiceId,
            status: 0,
          },
        }
      );

      if (affectedRows === 0 && order.status !== 1) {
        fastify.log.warn(tag_return + " 订单状态更新失败: " + invoiceId);
      }

      const pid = order.pid;
      const user = fastify.user.getUser(pid);
      if (!user) {
        fastify.log.error(tag_return + " PID不存在: " + pid);
        return reply.redirect(order.return_url);
      }

      const notifyUrl = epayUtils.buildPayNotifyCallbackUrl(order, token, user.key);

      fastify.log.info(tag_return + " order_notify_url：" + notifyUrl);
      await notifyWithRetry(fastify, notifyUrl, paypal.getClientId(), invoiceId);

      return reply.redirect(order.return_url);
    } catch (e) {
      fastify.log.error(tag_return + " 捕获订单失败: " + e.message);
      return reply.redirect(order.return_url);
    }
  });

  fastify.get("/pay/paypal_cancel", async function (request, reply) {
    const invoiceId = request.query.invoiceId;
    if (invoiceId) {
      const order = await fastify.db.models.Order.findOne({
        where: {
          out_trade_no: invoiceId,
          type: "paypal",
        },
      });
      if (order) {
        return reply.redirect(order.return_url);
      }
    }
    return reply.redirect("/");
  });
};
