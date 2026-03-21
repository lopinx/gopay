const fp = require("fastify-plugin");
const axios = require("axios");
const md5 = require("md5-node");

/**
 * epusdt 签名算法
 * 1. 过滤空值参数，排除 signature
 * 2. 按参数名 ASCII 升序排序
 * 3. 拼接为 key1=value1&key2=value2
 * 4. 末尾拼接 apiToken
 * 5. MD5 加密，结果转小写
 */
function epusdtSign(params, apiToken) {
  // 过滤空值和 signature
  const filtered = {};
  for (const key in params) {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      if (
        key !== "signature" &&
        params[key] !== "" &&
        params[key] !== undefined &&
        params[key] !== null
      ) {
        filtered[key] = params[key];
      }
    }
  }

  // 按键名排序
  const sortedKeys = Object.keys(filtered).sort();

  // 拼接字符串
  let signStr = "";
  for (let i = 0; i < sortedKeys.length; i++) {
    const key = sortedKeys[i];
    if (i > 0) {
      signStr += "&";
    }
    signStr += key + "=" + filtered[key];
  }

  // 追加 token 并 MD5
  signStr += apiToken;
  return md5(signStr).toLowerCase();
}

class Epusdt {
  constructor(host, apiToken) {
    this.host = host.replace(/\/$/, ""); // 去掉末尾斜杠
    this.apiToken = apiToken;
  }

  /**
   * 创建订单
   * @param {string} orderId - 商户订单号
   * @param {number} amount - 支付金额(CNY)
   * @param {string} notifyUrl - 异步回调地址
   * @param {string} redirectUrl - 同步跳转地址
   * @returns {Promise<Object>} - epusdt 响应数据
   */
  async createOrder(orderId, amount, notifyUrl, redirectUrl) {
    const params = {
      order_id: orderId,
      amount: parseFloat(amount).toFixed(2),
      notify_url: notifyUrl,
      redirect_url: redirectUrl,
    };

    const signature = epusdtSign(params, this.apiToken);
    params.signature = signature;

    try {
      const response = await axios.post(`${this.host}/api/v1/order/create-transaction`, params, {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 30000,
      });

      if (response.data.status_code === 200) {
        return response.data.data;
      } else {
        throw new Error(response.data.message || "创建订单失败");
      }
    } catch (error) {
      if (error.response) {
        throw new Error(error.response.data?.message || `HTTP ${error.response.status}`);
      }
      throw error;
    }
  }

  /**
   * 验证回调签名
   * @param {Object} data - 回调数据
   * @returns {boolean} - 签名是否有效
   */
  verifyCallback(data) {
    if (!data || !data.signature) {
      return false;
    }

    const receivedSign = data.signature;
    const computedSign = epusdtSign(data, this.apiToken);

    // 使用时序安全比较防止时序攻击
    try {
      const crypto = require("crypto");
      return crypto.timingSafeEqual(Buffer.from(computedSign), Buffer.from(receivedSign));
    } catch (e) {
      return computedSign === receivedSign;
    }
  }
}

module.exports = fp(async function (fastify, opts) {
  const epusdtRequiredFields = ["host", "apiToken"];
  const validEpusdtList = [];

  if (opts.epusdt && opts.epusdt.length > 0) {
    for (let i = 0; i < opts.epusdt.length; i++) {
      const cfg = opts.epusdt[i];
      const missingFields = epusdtRequiredFields.filter(function (f) {
        return !cfg[f];
      });

      if (missingFields.length > 0) {
        fastify.log.warn(
          "Epusdt 通道 #" + i + " 缺少字段: " + missingFields.join(", ") + "，已忽略"
        );
      } else {
        validEpusdtList.push(cfg);
      }
    }
  }

  if (validEpusdtList.length > 0) {
    fastify.log.info("Epusdt 可用通道数: " + validEpusdtList.length);
  }

  fastify.decorate("epusdt", {
    newInstance: function (host = "") {
      const len = validEpusdtList.length;
      if (len === 0) {
        return null;
      }

      let cfg;
      if (host) {
        cfg = validEpusdtList.find((c) => c.host === host);
        if (!cfg) {
          fastify.log.warn("Epusdt host not found: " + host + ", using random");
          const crypto = require("crypto");
          const index = crypto.randomInt(0, len);
          cfg = validEpusdtList[index];
        } else {
          fastify.log.info({ channel: "epusdt", host: cfg.host }, "指定使用 Epusdt");
        }
      } else {
        const crypto = require("crypto");
        const index = crypto.randomInt(0, len);
        cfg = validEpusdtList[index];
        fastify.log.info({ channel: "epusdt", index: index, host: cfg.host }, "随机使用 Epusdt");
      }

      return new Epusdt(cfg.host, cfg.apiToken);
    },
  });
});
