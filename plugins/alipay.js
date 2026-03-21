const { AlipaySdk } = require("alipay-sdk");
const fp = require("fastify-plugin");

const payCachePool = {};

class Alipay {
  constructor(appId, privateKey, alipayPublicKey) {
    this.appId = appId;
    if (!appId || !privateKey || !alipayPublicKey) {
      throw new Error("create Alipay err: missing required parameters");
    }
    if (payCachePool[appId]) {
      this.alipaySdk = payCachePool[appId];
    } else {
      this.alipaySdk = new AlipaySdk({
        appId: appId,
        privateKey: privateKey,
        alipayPublicKey: alipayPublicKey,
        signType: "RSA2",
      });
      payCachePool[appId] = this.alipaySdk;
    }
  }

  exec(
    outTradeNo,
    totalAmount,
    subject,
    body,
    agent = "page",
    notifyUrl = "",
    returnUrl = "",
  ) {
    const bizContent = {
      outTradeNo: outTradeNo,
      productCode: "FAST_INSTANT_TRADE_PAY",
      totalAmount: totalAmount,
      subject: subject,
      body: body,
    };

    const method = agent === "wap" ? "alipay.trade.wap.pay" : "alipay.trade.page.pay";

    return this.alipaySdk.pageExecute(method, "GET", {
      bizContent,
      notifyUrl: notifyUrl || undefined,
      returnUrl: returnUrl || undefined,
    });
  }

  checkNotifySign(notifyData) {
    return this.alipaySdk.checkNotifySign(notifyData);
  }
}

module.exports = fp(async function (fastify, opts) {
  let alipayRequiredFields = ["appId", "privateKey", "alipayPublicKey"];
  let validAlipayList = [];
  if (opts.alipay && opts.alipay.length > 0) {
    for (let i = 0; i < opts.alipay.length; i++) {
      let cfg = opts.alipay[i];
      let missingFields = alipayRequiredFields.filter(function (f) {
        return !cfg[f];
      });
      if (missingFields.length > 0) {
        fastify.log.warn(
          "Alipay 通道 #" +
          i +
          " (appId: " +
          (cfg.appId || "空") +
          ") 缺少字段: " +
          missingFields.join(", ") +
          "，已忽略",
        );
      } else {
        validAlipayList.push(cfg);
      }
    }
  }
  if (validAlipayList.length > 0) {
    fastify.log.info("Alipay 可用通道数: " + validAlipayList.length);
  }

  fastify.decorate("alipay", {
    newInstance: function (appId = "") {
      let len = validAlipayList.length;
      if (len > 0) {
        if (appId !== "") {
          let temp_i = -1;
          for (let i = 0; i < len; i++) {
            if (validAlipayList[i].appId === appId) {
              temp_i = i;
              break;
            }
          }
          if (temp_i !== -1) {
            let alipayc = validAlipayList[temp_i];
            return new Alipay(
              alipayc.appId,
              alipayc.privateKey,
              alipayc.alipayPublicKey,
            );
          } else {
            return null;
          }
        }

  const crypto = require('crypto');
    let alipayindex = crypto.randomInt(0, len);
    let alipayc = validAlipayList[alipayindex];

    fastify.log.info({ channel: 'alipay', index: alipayindex, appId: alipayc.appId }, "随机使用 Alipay");

        return new Alipay(
          alipayc.appId,
          alipayc.privateKey,
          alipayc.alipayPublicKey,
        );
      } else {
        return null;
      }
    },
  });
});
