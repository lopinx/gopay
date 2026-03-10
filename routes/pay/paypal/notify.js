const epayUtils = require("../../../utils/epayutils");

const tag_webhook = "paypal_webhook";

module.exports = async function (fastify, opts) {
  fastify.post("/pay/paypal_notify", async function (request, reply) {
    let eventType = request.body.event_type;
    let resource = request.body.resource;

    fastify.log.info(tag_webhook + " 收到事件: " + eventType);

    if (
      eventType === "CHECKOUT.ORDER.APPROVED" ||
      eventType === "PAYMENT.CAPTURE.COMPLETED"
    ) {
      let orderId = resource.id;
      let referenceId = resource.purchase_units[0].reference_id;

      let order = await fastify.db.models.Order.findOne({
        where: {
          id: referenceId,
        },
      });

      if (order == null) {
        fastify.log.info(tag_webhook + " 订单未找到: " + referenceId);
        return { code: 404, msg: "订单未找到" };
      }

      if (order.status !== 1) {
        order.status = 1;
        await order.save();
      }

      let pid = order.pid;
      let user = fastify.user.getUser(pid);
      if (user == null) {
        return fastify.resp.SYS_ERROR("PID不存在，无法通知");
      }

      let orderNotifyUrl = epayUtils.buildPayNotifyCallbackUrl(
        order,
        orderId,
        user.key,
      );

      fastify.log.info(tag_webhook + " 通知源站: " + orderNotifyUrl);
      try {
        const { data, status } = await fastify.axios.get(orderNotifyUrl);
        if (status >= 200 && status < 500) {
          fastify.log.info(tag_webhook + " 源站通知成功: " + data);
          return { code: 200, msg: "成功" };
        }
      } catch (e) {
        fastify.log.info(tag_webhook + " 通知源站失败: " + e.message);
      }
    }

    return { code: 200, msg: "OK" };
  });
};
