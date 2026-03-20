# plugins/ — Fastify 插件层

SDK 封装、数据库模型、商户查询、响应码常量。

## 文件职责

| 文件 | 装饰为 | 职责 |
|------|--------|------|
| `alipay.js` | `fastify.alipay` | 支付宝 SDK 工厂 + payCachePool 缓存 |
| `wxpay.js` | `fastify.wxpay` | 微信支付 v3 SDK 工厂 + payCachePool 缓存 |
| `database.js` | `fastify.db` | Sequelize 实例 + Order 模型 |
| `user.js` | `fastify.user` | PID → 商户 key 映射查询 |
| `constans.js` | `fastify.resp` | 响应构建器（EMPTY_PARAMS/SIGN_ERROR 等） |

## SDK 插件模式

```javascript
// payCachePool 模块级缓存（禁止外部创建实例）
const payCachePool = {};

class Alipay {
  constructor(appId, privateKey, alipayPublicKey) {
    if (payCachePool[appId]) return payCachePool[appId]; // 命中缓存
    this.alipaySdk = new AlipaySdk({...});
    payCachePool[appId] = this.alipaySdk;
  }
}

// 插件导出
module.exports = fp(async function (fastify, opts) {
  // 过滤不完整配置
  let validList = opts.alipay.filter(cfg => 
    cfg.appId && cfg.privateKey && cfg.alipayPublicKey
  );
  
  fastify.decorate("alipay", {
    newInstance: (appId = "") => {
      // Math.random() 负载均衡
      let cfg = validList[Math.floor(Math.random() * validList.length)];
      return new Alipay(cfg.appId, cfg.privateKey, cfg.alipayPublicKey);
    }
  });
});
```

## 通道校验规则

- **alipay**: `appId`, `privateKey`, `alipayPublicKey` 必填
- **wxpay**: `appId`, `mchid`, `privateKey`, `serial`, `secret` 必填
- 缺失字段 → 启动时警告并忽略该通道

## Order 模型

```javascript
// plugins/database.js — 单表 gopay_order
{
  id: STRING(40),          // 主键（微信UUID/支付宝out_trade_no）
  out_trade_no: STRING,    // 源站订单号
  notify_url: STRING,      // 源站回调地址
  return_url: STRING,      // 源站跳转地址
  type: STRING(10),        // alipay/wxpay
  pid: INTEGER,            // 商户ID
  title: STRING,           // 订单标题
  money: STRING,           // 金额
  status: INTEGER,         // 0待支付/1已支付
  attach: STRING           // 扩展字段
}
```

## 响应码使用

```javascript
// 路由中调用
return fastify.resp.EMPTY_PARAMS("sign");     // { code: 403, msg: "sign 参数不能为空" }
return fastify.resp.SIGN_ERROR;               // { code: 403, msg: "请求签名校验失败" }
return fastify.resp.ALIPAY_NO;                // { code: 400, msg: "未配置 alipay 渠道信息" }
return fastify.resp.SYS_ERROR("自定义错误");   // { code: 500, msg: "自定义错误" }
return fastify.resp.ALIPAY_OK;                // "success"（支付宝回调响应）
return fastify.resp.WXPAY_OK;                 // { code: "SUCCESS", message: "成功" }
```

## 反模式

- **禁止** 在 `payCachePool` 外创建 SDK 实例
- **禁止** 修改 `constans.js` 文件名（拼写错误但 autoload 依赖）
- `pid instanceof Number` 在 `user.js:7` 永远返回 false（原始类型）
