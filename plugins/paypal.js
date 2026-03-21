const fp = require("fastify-plugin");
const paypal = require("@paypal/checkout-server-sdk");

const payCachePool = {};

class Paypal {
  constructor(clientId, clientSecret, sandbox = true, currency = "USD") {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.sandbox = sandbox;
    this.currency = currency;

    const environment = sandbox
      ? new paypal.core.SandboxEnvironment(clientId, clientSecret)
      : new paypal.core.LiveEnvironment(clientId, clientSecret);

    if (payCachePool[clientId]) {
      this.client = payCachePool[clientId];
    } else {
      this.client = new paypal.core.PayPalHttpClient(environment);
      payCachePool[clientId] = this.client;
    }
  }

  getClientId() {
    return this.clientId;
  }

  /**
   * 创建 PayPal 订单
   * @param {string} invoiceId - 商户订单号 (out_trade_no)
   * @param {number} amount - 金额
   * @param {string} description - 订单描述
   * @param {string} returnUrl - 支付成功后返回地址
   * @param {string} cancelUrl - 支付取消返回地址
   * @returns {Promise<Object>} - 包含 approveUrl 和 orderId
   */
  async createOrder(invoiceId, amount, description, returnUrl, cancelUrl) {
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: this.currency,
            value: amount.toFixed(2),
          },
          description: description,
          invoice_id: invoiceId,
        },
      ],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        user_action: "PAY_NOW",
      },
    });

    const response = await this.client.execute(request);
    const orderId = response.result.id;

    const approveLink = response.result.links.find((link) => link.rel === "approve");

    if (!approveLink) {
      throw new Error("未找到 PayPal 批准链接");
    }

    return {
      orderId: orderId,
      approveUrl: approveLink.href,
    };
  }

  /**
   * 捕获订单支付
   * @param {string} orderId - PayPal 订单 ID
   * @returns {Promise<Object>} - 捕获结果
   */
  async captureOrder(orderId) {
    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.prefer("return=representation");
    const response = await this.client.execute(request);
    return response.result;
  }

  /**
   * 查询订单详情
   * @param {string} orderId - PayPal 订单 ID
   * @returns {Promise<Object>} - 订单详情
   */
  async getOrder(orderId) {
    const request = new paypal.orders.OrdersGetRequest(orderId);
    const response = await this.client.execute(request);
    return response.result;
  }

  /**
   * 验证 Webhook 签名
   * @param {Object} headers - 请求头
   * @param {string} body - 请求体原始字符串
   * @param {string} webhookId - Webhook ID
   * @returns {boolean} - 签名是否有效
   */
  verifyWebhookSignature(headers, body, webhookId) {
    const transmissionId = headers["paypal-transmission-id"];
    const certUrl = headers["paypal-cert-url"];
    const authAlgo = headers["paypal-auth-algo"];
    const transmissionSig = headers["paypal-transmission-sig"];
    const timestamp = headers["paypal-transmission-time"];

    if (!transmissionId || !certUrl || !authAlgo || !transmissionSig || !timestamp) {
      return false;
    }

    const expectedSig = transmissionId + "|" + timestamp + "|" + webhookId + "|" + body;
    const crypto = require("crypto");

    try {
      const verifier = crypto.createVerify(authAlgo);
      verifier.update(expectedSig);
      return verifier.verify(certUrl, transmissionSig, "base64");
    } catch (e) {
      return false;
    }
  }
}

module.exports = fp(async function (fastify, opts) {
  const paypalRequiredFields = ["clientId", "clientSecret"];
  const validPaypalList = [];

  if (opts.paypal && opts.paypal.length > 0) {
    for (let i = 0; i < opts.paypal.length; i++) {
      const cfg = opts.paypal[i];
      const missingFields = paypalRequiredFields.filter(function (f) {
        return !cfg[f];
      });

      if (missingFields.length > 0) {
        fastify.log.warn(
          "Paypal 通道 #" + i + " 缺少字段: " + missingFields.join(", ") + "，已忽略"
        );
      } else {
        validPaypalList.push(cfg);
      }
    }
  }

  if (validPaypalList.length > 0) {
    fastify.log.info("Paypal 可用通道数: " + validPaypalList.length);
  }

  fastify.decorate("paypal", {
    newInstance: function (clientId = "") {
      const len = validPaypalList.length;
      if (len === 0) {
        return null;
      }

      let cfg;
      if (clientId) {
        cfg = validPaypalList.find((c) => c.clientId === clientId);
        if (!cfg) {
          fastify.log.warn("Paypal clientId not found: " + clientId + ", using random");
          const crypto = require("crypto");
          const index = crypto.randomInt(0, len);
          cfg = validPaypalList[index];
        } else {
          fastify.log.info({ channel: "paypal", clientId: cfg.clientId }, "指定使用 Paypal");
        }
      } else {
        const crypto = require("crypto");
        const index = crypto.randomInt(0, len);
        cfg = validPaypalList[index];
        fastify.log.info(
          { channel: "paypal", index: index, clientId: cfg.clientId },
          "随机使用 Paypal"
        );
      }

      return new Paypal(
        cfg.clientId,
        cfg.clientSecret,
        cfg.sandbox !== false,
        cfg.currency || "USD"
      );
    },
  });
});
