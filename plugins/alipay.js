const AlipaySdk = require("alipay-sdk").default;
const AlipayFormData = require("alipay-sdk/lib/form").default;
const fp = require("fastify-plugin");

const payCachePool = {};

class Alipay {
  alipaySdk = null;
  appId = "";

  constructor(appId, privateKey, alipayPublicKey) {
    if (!appId || !privateKey || !alipayPublicKey) {
      throw "create Alipay err";
    }
    if (payCachePool[appId] !== undefined) {
      // 取缓存
      this.alipaySdk = payCachePool[appId];
    } else {
      this.alipaySdk = new AlipaySdk({
        /** 支付宝网关 **/
        gateway: "https://openapi.alipay.com/gateway.do",
        appId: (this.appId = appId),
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
    let formData = new AlipayFormData();
    formData.setMethod("get");
    if (notifyUrl) {
      formData.addField("notify_url", notifyUrl);
    }
    if (returnUrl) {
      formData.addField("return_url", returnUrl);
    }

    formData.addField("bizContent", {
      outTradeNo: outTradeNo, // 订单号
      productCode: "FAST_INSTANT_TRADE_PAY", // 常量不需要修改
      totalAmount: totalAmount,
      subject: subject,
      body: body,
    });

    return this.alipaySdk.exec(
      "alipay.trade." + agent + ".pay",
      {},
      {
        formData: formData,
      },
      { validateSign: true },
    );
  }
}

module.exports = fp(async function (fastify, opts) {
  // 过滤不完整的支付宝通道配置，所有必填字段非空才启用
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
            ).alipaySdk;
          } else {
            return null;
          }
        }

        let alipayindex = Math.floor(Math.random() * len);
        let alipayc = validAlipayList[alipayindex];

        fastify.log.info("随机使用 Alipay : " + alipayindex);
        fastify.log.info(alipayc);

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
