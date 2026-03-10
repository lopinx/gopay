const fp = require("fastify-plugin");
const paypal = require("@paypal/checkout-server-sdk");

const payCachePool = {};

class Paypal {
  paypalClient = null;
  clientId = "";
  mode = "";

  constructor(clientId, secret, mode) {
    if (!clientId || !secret || !mode) {
      throw "create PayPal err";
    }
    this.clientId = clientId;
    this.mode = mode;
    let cacheKey = clientId + "_" + mode;
    if (payCachePool[cacheKey] !== undefined) {
      this.paypalClient = payCachePool[cacheKey];
    } else {
      let environment =
        mode === "live"
          ? new paypal.core.LiveEnvironment(clientId, secret)
          : new paypal.core.SandboxEnvironment(clientId, secret);
      this.paypalClient = new paypal.core.PayPalHttpClient(environment);
      payCachePool[cacheKey] = this.paypalClient;
    }
  }

  async createOrder(
    outTradeNo,
    totalAmount,
    currency = "USD",
    description = "",
  ) {
    let request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: outTradeNo,
          description: description,
          amount: {
            currency_code: currency,
            value: totalAmount,
          },
        },
      ],
    });
    return await this.paypalClient.execute(request);
  }

  async captureOrder(orderId) {
    let request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});
    return await this.paypalClient.execute(request);
  }
}

module.exports = fp(async function (fastify, opts) {
  let paypalRequiredFields = ["clientId", "secret", "mode"];
  let validPaypalList = [];
  if (opts.paypal && opts.paypal.length > 0) {
    for (let i = 0; i < opts.paypal.length; i++) {
      let cfg = opts.paypal[i];
      let missingFields = paypalRequiredFields.filter(function (f) {
        return !cfg[f];
      });
      if (missingFields.length > 0) {
        fastify.log.warn(
          "Paypal 通道 #" +
            i +
            " (clientId: " +
            (cfg.clientId || "空") +
            ") 缺少字段: " +
            missingFields.join(", ") +
            "，已忽略",
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
      let len = validPaypalList.length;
      if (len > 0) {
        if (clientId !== "") {
          let temp_i = -1;
          for (let i = 0; i < len; i++) {
            if (validPaypalList[i].clientId === clientId) {
              temp_i = i;
              break;
            }
          }
          if (temp_i !== -1) {
            let paypalc = validPaypalList[temp_i];
            return new Paypal(paypalc.clientId, paypalc.secret, paypalc.mode);
          } else {
            return null;
          }
        }

        let paypalindex = Math.floor(Math.random() * len);
        let paypalc = validPaypalList[paypalindex];

        fastify.log.info("随机使用 PayPal : " + paypalindex);
        fastify.log.info(paypalc);

        return new Paypal(paypalc.clientId, paypalc.secret, paypalc.mode);
      } else {
        return null;
      }
    },
  });
});
