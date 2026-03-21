const epayUtils = require("../../../utils/epayutils");

const tag_notify = "epusdt_notify";

async function notifyWithRetry(fastify, url, outTradeNo, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const { status } = await fastify.axios.get(url);
      if (status >= 200 && status < 500) {
        fastify.log.info(tag_notify + " 通知成功, out_trade_no:" + outTradeNo);
        return true;
      }
    } catch (e) {
      fastify.log.error(
        tag_notify +
          " 通知失败 (attempt " +
          (i + 1) +
          "/" +
          maxRetries +
          "), out_trade_no:" +
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
  fastify.post("/pay/epusdt_notify", async function (request, reply) {
    const body = request.body;

    // 基本参数校验
    if (!body || !body.order_id) {
      fastify.log.warn(tag_notify + " 缺少 order_id");
      return "fail";
    }

    const orderId = body.order_id;

    // 查询订单
    const order = await fastify.db.models.Order.findOne({
      where: {
        out_trade_no: orderId,
      },
    });

    if (!order) {
      fastify.log.warn(tag_notify + " 订单不存在: " + orderId);
      return "fail";
    }

    // 获取 epusdt 实例进行验签 - 使用订单中保存的特定 host
    const epusdt = fastify.epusdt.newInstance(order.attach);
    if (!epusdt) {
      fastify.log.error(tag_notify + " epusdt 未配置");
      return "fail";
    }

    // 验签
    if (!epusdt.verifyCallback(body)) {
      fastify.log.warn(tag_notify + " 签名验证失败: " + orderId);
      return "fail";
    }

    // 检查支付状态
    const status = body.status;
    if (status !== 2) {
      // 2 = 支付成功
      fastify.log.info(tag_notify + " 订单状态非成功: " + status + ", order_id:" + orderId);
      return "ok"; // 非成功状态也返回 ok，防止重试
    }

    // 更新订单状态
    const [affectedRows] = await fastify.db.models.Order.update(
      { status: 1 },
      {
        where: {
          out_trade_no: orderId,
          status: 0,
        },
      }
    );

    if (affectedRows === 0 && order.status !== 1) {
      fastify.log.warn(tag_notify + " 订单状态更新失败，可能已被处理, order_id:" + orderId);
    }

    // 获取商户信息
    const pid = order.pid;
    const user = fastify.user.getUser(pid);
    if (!user) {
      fastify.log.error(tag_notify + " PID不存在: " + pid);
      return "ok"; // 返回 ok 防止 epusdt 重试
    }

    // 构建源站回调 URL
    const notifyUrl = epayUtils.buildPayNotifyCallbackUrl(order, body.trade_id, user.key);

    fastify.log.info(tag_notify + " order_notify_url：" + notifyUrl);

    // 通知源站
    await notifyWithRetry(fastify, notifyUrl, orderId);

    // epusdt 要求返回 "ok"
    return "ok";
  });
};
