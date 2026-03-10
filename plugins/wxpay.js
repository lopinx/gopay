const fp = require("fastify-plugin");
const { Wechatpay, Formatter } = require("wechatpay-axios-plugin");

// sdk 缓存池
const payCachePool = {};

class Wxpay {
  wxpaysdk;
  appid;
  mchid;
  secret;
  only_native;

  constructor(opts) {
    this.appid = opts.appId;
    this.mchid = opts.mchid;
    this.secret = opts.secret;
    this.only_native = opts.only_native;

    if (payCachePool[opts.appId] !== undefined) {
      // 取缓存
      this.wxpaysdk = payCachePool[opts.appId];
    } else {
      this.wxpaysdk = new Wechatpay({
        mchid: opts.mchid,
        serial: opts.serial, // 官网上的 serialno
        privateKey: opts.privateKey,
        certs: opts.certs,
        // APIv2参数 >= 0.4.0 开始支持
        secret: opts.secret,
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

  /**
   *
   * @param type
   * @param data
   * @returns {{amount: {total: (number|{jsMemoryEstimate: number, jsMemoryRange: [number, number]}|PaymentItem), currency: string}, mchid: (string|string), out_trade_no: (string|string), appid: *, description: (*|string), notify_url: StringDataTypeConstructor | string}|null|{amount: {total: (number|{jsMemoryEstimate: number, jsMemoryRange: [number, number]}|PaymentItem), currency: string}, mchid: any, out_trade_no: (string|string), appid: *, description: (*|string), attach: string, notify_url: StringDataTypeConstructor | string, scene_info: {h5_info: {app_name: string, app_url: string, type: string}, payer_client_ip: string}}}
   */
  formData(type, data) {
    if (this.only_native) {
      type = "native";
      // 当前渠道强制使用扫码
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

  exec(formData) {
    if (formData === null) {
      throw "wxpay form is Null";
    }
    if (formData.scene_info) {
      // h5
      return this.wxpaysdk.v3.pay.transactions.h5.post(formData);
    } else {
      return this.wxpaysdk.v3.pay.transactions.native.post(formData);
    }
  }
}

module.exports = fp(async function (fastify, opts) {
  // 过滤不完整的微信支付通道配置，所有必填字段非空才启用
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
          // certs 必须是对象且至少有一个 key
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

        let wxpayindex = Math.floor(Math.random() * len);
        let wxpayc = validWxpayList[wxpayindex];

        fastify.log.info("随机使用 Wxpay : " + wxpayindex);
        //fastify.log.info(wxpayc)

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
