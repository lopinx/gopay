const epayUtils = require("../../../utils/epayutils");

const tag_notify = "paypal_notify";

async function notifyWithRetry(fastify, url, clientId, outTradeNo, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const { status } = await fastify.axios.get(url);
      if (status >= 200 && status < 500) {
        fastify.log.info(
          tag_notify + " 通知成功, clientId:" + clientId + ", out_trade_no:" + outTradeNo
        );
        return true;
      }
    } catch (e) {
      fastify.log.error(
        tag_notify +
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
  fastify.post("/pay/paypal_notify", async function (request, reply) {
    const body = request.body;

    if (!body || !body.resource) {
      fastify.log.warn(tag_notify + " 无效的请求体");
      return reply.code(400).send("Bad Request");
    }

    const eventType = body.event_type;
    if (eventType !== "CHECKOUT.ORDER.APPROVED" && eventType !== "CHECKOUT.ORDER.COMPLETED") {
      fastify.log.info(tag_notify + " 非支付完成事件: " + eventType);
      return reply.code(200).send("OK");
    }

    const resource = body.resource;
    const paypalOrderId = resource.id;
    const invoiceId = resource.invoice_id;

    if (!invoiceId) {
      fastify.log.warn(tag_notify + " 缺少 invoice_id");
      return reply.code(400).send("Bad Request");
    }

    const order = await fastify.db.models.Order.findOne({
      where: {
        out_trade_no: invoiceId,
        type: "paypal",
      },
    });

    if (!order) {
      fastify.log.warn(tag_notify + " 订单不存在: " + invoiceId);
      return reply.code(404).send("Order Not Found");
    }

    if (order.status === 1) {
      fastify.log.info(tag_notify + " 订单已处理: " + invoiceId);
      return reply.code(200).send("OK");
    }

    try {
      // 安全验证：从 PayPal 服务器查询订单状态
      const paypal = fastify.paypal.newInstance(order.attach);
      if (!paypal) {
        fastify.log.error(tag_notify + " PayPal 未配置: " + order.attach);
        return reply.code(500).send("PayPal Not Configured");
      }

      const paypalOrder = await paypal.getOrder(paypalOrderId);
      if (paypalOrder.status !== "APPROVED" && paypalOrder.status !== "COMPLETED") {
        fastify.log.warn(tag_notify + " PayPal 订单未支付: " + paypalOrder.status);
        return reply.code(400).send("Order Not Paid");
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

      if (affectedRows === 0) {
        fastify.log.warn(tag_notify + " 订单状态更新失败，可能已被处理: " + invoiceId);
        return reply.code(200).send("OK");
      }

      const pid = order.pid;
      const user = fastify.user.getUser(pid);
      if (!user) {
        fastify.log.error(tag_notify + " PID不存在: " + pid);
        return reply.code(200).send("OK");
      }

      const notifyUrl = epayUtils.buildPayNotifyCallbackUrl(order, paypalOrderId, user.key);

      fastify.log.info(tag_notify + " order_notify_url：" + notifyUrl);
      await notifyWithRetry(fastify, notifyUrl, "webhook", invoiceId);

      return reply.code(200).send("OK");
    } catch (e) {
      fastify.log.error(tag_notify + " 处理失败: " + e.message);
      return reply.code(500).send("Internal Error");
    }
  });
};
