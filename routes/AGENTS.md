# routes/ — API 路由层

易支付协议兼容入口、订单查询、支付回调处理。

## 路由表

| 路由                       | 方法 | 文件                   | 职责                   |
| -------------------------- | ---- | ---------------------- | ---------------------- |
| `/submit.php`              | POST | `submit.js`            | 易支付下单入口（核心） |
| `/api/order_status`        | GET  | `order.js`             | 订单状态查询           |
| `/go`                      | GET  | `redirect.js`          | 支付跳转中间页         |
| `/pay/alipay_notify`       | POST | `pay/alipay/notify.js` | 支付宝异步回调         |
| `/pay/alipay_return`       | GET  | `pay/alipay/notify.js` | 支付宝同步返回         |
| `/pay/wxpay_notify/:appid` | POST | `pay/wechat/notify.js` | 微信异步回调           |
| `/pay/wxpay/native`        | GET  | `pay/wechat/native.js` | 扫码支付页             |

## 下单流程 (submit.js)

```javascript
// 1. 参数提取（支持 POST/GET）
let fromWhere = request.body || request.query;

// 2. 参数校验（手动校验，无中间件）
if (stringUtils.isEmpty(sign)) return fastify.resp.EMPTY_PARAMS("sign");

// 3. PID 查询
let user = fastify.user.getUser(pid);  // → { key: "xxx" }

// 4. 签名验证（易支付 MD5）
let params = stringUtils.sortParams(stringUtils.filterParams(fromWhere));
if (!stringUtils.checkSign(params, sign, user.key)) return fastify.resp.SIGN_ERROR;

// 5. 类型分发
if (type === "alipay") {
  let alipay = fastify.alipay.newInstance();
  payurl = await alipay.exec(...);
  await Order.create({ id: out_trade_no, ... });  // 使用源站订单号
} else if (type === "wxpay") {
  let uuid = uuidv4().replace(/-/g, "").toUpperCase();
  await Order.create({ id: uuid, out_trade_no, ... });  // 使用 UUID
}

// 6. 返回跳转页
return reply.view("/templates/submit.ejs", { payurl, type });
```

## 回调处理流程

### 支付宝 (pay/alipay/notify.js)

```javascript
// 1. RSA2 验签（SDK 内置）
if (!alipay.checkNotifySign(request.body)) return "fail";

// 2. 更新订单
await Order.update({ status: 1 }, { where: { out_trade_no } });

// 3. 构建源站回调 URL
let notifyUrl = buildPayNotifyCallbackUrl(order, trade_no, user.key);

// 4. GET 通知源站（无重试实现）
await fastify.axios.get(notifyUrl);
return "success";
```

### 微信 (pay/wechat/notify.js)

```javascript
// 1. AES-256-GCM 解密
let decryptJson = aes.decrypt(
  request.body.resource.nonce,
  secret,
  request.body.resource.ciphertext,
  request.body.resource.associated_data
);
let data = JSON.parse(decryptJson);

// 2. 查询并更新
let order = await Order.findOne({ where: { id: data.out_trade_no } });
await order.update({ status: 1 });

// 3. GET 通知源站
await fastify.axios.get(buildPayNotifyCallbackUrl(order, trade_no, user.key));
return { code: "SUCCESS", message: "成功" };
```

## 反模式

- `submit.js:159-162`: 支付宝错误被静默吞掉 `catch(e) { err = true; }`
- `pay/wechat/notify.js:62`: `const {data, status}` 与外层 `data` 变量遮蔽
- `submit.js:191`: `parseInt(money) * 100` 不支持小数金额
- 回调注释声称有重试，实际无实现

## 响应格式

| 场景 | 支付宝      | 微信                  |
| ---- | ----------- | --------------------- |
| 成功 | `"success"` | `{ code: "SUCCESS" }` |
| 失败 | `"fail"`    | `{ code: "FAIL" }`    |
