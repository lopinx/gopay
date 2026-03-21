const fp = require("fastify-plugin");
const { Client } = require("wechatpay-node-v3");

const payCachePool = {};

class Wxpay {
  constructor(opts) {
    this.appid = opts.appId;
    this.mchid = opts.mchid;
    this.secret = opts.secret;
    this.only_native = opts.only_native;

    if (payCachePool[opts.appId]) {
      this.wxpaysdk = payCachePool[opts.appId];
    } else {
      this.wxpaysdk = new Client({
        appid: opts.appId,
        mchid: opts.mchid,
        serial: opts.serial,
        privateKey: opts.privateKey,
        certs: opts.certs,
        key: opts.secret,
      });
      payCachePool[opts.appId] = this.wxpaysdk;
    }
  }

  getAppid() {
    return this.appid;
  }

  getSecret() {
    return this.secret;
  }

  isOnlyNavtive() {
    return this.only_native;
  }

  formData(type, data) {
    if (this.only_native) {
      type = "native";
    }
    if (type === "h5") {
      return {
        amount: {
          total: data.total,
          currency: "CNY",
        },
        mchid: this.mchid,
        description: data.description ? data.description : "",
        notify_url: data.notify_url,
        out_trade_no: data.out_trade_no,
        appid: this.appid,
        attach: this.appid,
        scene_info: {
          h5_info: {
            app_name: "GOPAY",
            app_url: "https://pay.gopay.com",
            type: "h5",
          },
          payer_client_ip: data.payer_client_ip,
        },
      };
    } else if (type === "native") {
      return {
        amount: {
          total: data.total,
          currency: "CNY",
        },
        mchid: this.mchid,
        description: data.description ? data.description : "",
        notify_url: data.notify_url,
        out_trade_no: data.out_trade_no,
        appid: this.appid,
        attach: this.appid,
      };
    } else {
      return null;
    }
  }

  async exec(formData) {
    if (formData === null || formData === undefined) {
      throw new Error("wxpay form is Null");
    }
    if (formData.scene_info) {
      return await this.wxpaysdk.chain("POST /v3/pay/transactions/h5", formData);
    } else {
      return await this.wxpaysdk.chain("POST /v3/pay/transactions/native", formData);
    }
  }
}

module.exports = fp(async function (fastify, opts) {
  let wxpayRequiredFields = [
    "appId",
    "mchid",
    "privateKey",
    "serial",
    "secret",
    "certs",
  ];
  let validWxpayList = [];
  if (opts.wxpay && opts.wxpay.length > 0) {
    for (let i = 0; i < opts.wxpay.length; i++) {
      let cfg = opts.wxpay[i];
      let missingFields = wxpayRequiredFields.filter(function (f) {
        if (f === "certs") {
          return (
            !cfg[f] ||
            typeof cfg[f] !== "object" ||
            Object.keys(cfg[f]).length === 0
          );
        }
        return !cfg[f];
      });
      if (missingFields.length > 0) {
        fastify.log.warn(
          "Wxpay 通道 #" +
          i +
          " (appId: " +
          (cfg.appId || "空") +
          ") 缺少字段: " +
          missingFields.join(", ") +
          "，已忽略",
        );
      } else {
        validWxpayList.push(cfg);
      }
    }
  }
  if (validWxpayList.length > 0) {
    fastify.log.info("Wxpay 可用通道数: " + validWxpayList.length);
  }

  fastify.decorate("wxpay", {
    newInstance: function (appId = "") {
      let len = validWxpayList.length;
      if (len > 0) {
        if (appId !== "") {
          let temp_i = -1;
          for (let i = 0; i < len; i++) {
            if (validWxpayList[i].appId === appId) {
              temp_i = i;
              break;
            }
          }
          if (temp_i !== -1) {
            let wxpayc = validWxpayList[temp_i];

            return new Wxpay({
              appId: wxpayc.appId,
              mchid: wxpayc.mchid,
              serial: wxpayc.serial,
              privateKey: wxpayc.privateKey,
              certs: wxpayc.certs,
              secret: wxpayc.secret,
              only_native: wxpayc.only_native,
            });
          } else {
            return null;
          }
        }

  const crypto = require('crypto');
    let wxpayindex = crypto.randomInt(0, len);
    let wxpayc = validWxpayList[wxpayindex];

    fastify.log.info({ channel: 'wxpay', index: wxpayindex, appId: wxpayc.appId }, "随机使用 Wxpay");

        return new Wxpay({
          appId: wxpayc.appId,
          mchid: wxpayc.mchid,
          serial: wxpayc.serial,
          privateKey: wxpayc.privateKey,
          certs: wxpayc.certs,
          secret: wxpayc.secret,
          only_native: wxpayc.only_native,
        });
      } else {
        return null;
      }
    },
  });
});
