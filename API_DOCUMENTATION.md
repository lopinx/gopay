# GoPay API接口文档

GoPay是一个兼容易支付的Node.js版支付系统，支持支付宝和微信支付。本文档详细描述了系统提供的所有API接口。

## 接口访问URL

接口可以通过两种形式访问：

1. **原生接口**：直接调用GoPay系统提供的原生API接口
2. **易支付兼容接口**：兼容原有易支付系统的接口调用方式

开发者可以根据自己的需求选择合适的接口调用方式。

### 原生接口与易支付兼容接口的区别

- **原生接口**：GoPay系统直接提供的API接口，按照标准的RESTful API设计
- **易支付兼容接口**：为了兼容原有易支付系统的调用方式，保持接口参数和响应格式与易支付一致，方便现有系统无缝迁移

对于大多数接口而言，原生接口和易支付兼容接口实际上是同一个接口，只是在文档中做了区分说明。对于支付回调类接口（如支付宝异步通知、微信支付异步通知），这些是由第三方支付平台直接调用的URL，不属于开发者主动调用的接口。

## 目录

1. [支付提交接口](#支付提交接口)
2. [支付宝异步通知接口](#支付宝异步通知接口)
3. [支付宝同步返回接口](#支付宝同步返回接口)
4. [微信支付异步通知接口](#微信支付异步通知接口)
5. [微信扫码支付页面接口](#微信扫码支付页面接口)
6. [订单状态查询接口](#订单状态查询接口)
7. [跳转接口](#跳转接口)
8. [首页接口](#首页接口)
9. [测试接口](#测试接口)
10. [公共响应格式](#公共响应格式)
11. [签名算法](#签名算法)
12. [数据库结构](#数据库结构)

## 支付提交接口

### 接口说明
兼容易支付submit.php接口，处理支付请求并跳转到相应支付渠道。

### 请求URL

1. 原生接口：`POST {payUrl}/submit.php`
2. 易支付兼容接口：`POST {payUrl}/submit.php` (与原生接口相同，兼容易支付调用方式)

### 请求参数
| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| pid | string | 是 | 商户PID |
| type | string | 是 | 支付方式，alipay(支付宝)或wxpay(微信) |
| out_trade_no | string | 是 | 商户订单号 |
| notify_url | string | 是 | 异步通知地址 |
| return_url | string | 是 | 同步跳转地址 |
| name | string | 是 | 商品名称 |
| money | string | 是 | 金额 |
| sign | string | 是 | 签名 |
| sign_type | string | 否 | 签名类型，默认MD5 |

### 响应说明
成功时会跳转到相应的支付页面，失败时返回JSON格式错误信息。

### 示例请求
```http
POST /submit.php HTTP/1.1
Content-Type: application/x-www-form-urlencoded

pid=10001&type=alipay&out_trade_no=20231001001&notify_url=https://example.com/notify&return_url=https://example.com/return&name=测试商品&money=100.00&sign=签名值
```

## 支付宝异步通知接口

### 接口说明
接收支付宝支付结果异步通知，更新订单状态并通知商户。

### 请求URL

1. 原生接口：`POST {payUrl}/pay/alipay_notify`
2. 易支付兼容接口：支付宝官方回调URL，由支付宝服务器直接调用

### 请求参数
支付宝官方参数，包括：
- app_id: 支付宝应用ID
- out_trade_no: 商户订单号
- trade_no: 支付宝交易号
- trade_status: 交易状态
- 其他支付宝回调参数

### 响应说明
处理成功返回"success"，失败返回"fail"。

### 示例响应
```http
HTTP/1.1 200 OK
Content-Type: text/plain

success
```

## 支付宝同步返回接口

### 接口说明
支付宝支付完成后同步跳转回商户网站。

### 请求URL

1. 原生接口：`GET {payUrl}/pay/alipay_return`
2. 易支付兼容接口：支付宝官方回调URL，由支付宝服务器直接调用

### 请求参数
支付宝官方参数，包括：
- app_id: 支付宝应用ID
- out_trade_no: 商户订单号
- trade_no: 支付宝交易号
- 其他支付宝回调参数

### 响应说明
跳转到商户指定的return_url地址。

## 微信支付异步通知接口

### 接口说明
接收微信支付结果异步通知，更新订单状态并通知商户。

### 请求URL

1. 原生接口：`POST {payUrl}/pay/wxpay_notify/{appid}`
2. 易支付兼容接口：微信支付官方回调URL，由微信支付服务器直接调用

### URL参数
| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| appid | string | 是 | 微信支付应用ID |

### 请求参数
微信官方回调参数，包括：
- event_type: 事件类型
- resource: 加密的回调数据

### 响应说明
处理成功返回{"code": "SUCCESS", "message": "成功"}，失败返回相应错误信息。

### 示例响应
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "code": "SUCCESS",
  "message": "成功"
}
```

## 订单状态查询接口

### 接口说明
查询订单支付状态。

### 请求URL

1. 原生接口：`GET {payUrl}/api/order_status`
2. 易支付兼容接口：`GET {payUrl}/api/order_status` (与原生接口相同)

### 请求参数
| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| out_trade_no | string | 是 | 商户订单号 |
| type | string | 是 | 支付方式，alipay或wxpay |

### 响应说明
返回订单状态信息。

### 示例请求
```http
GET /api/order_status?out_trade_no=20231001001&type=alipay HTTP/1.1
```

### 示例响应
```json
{
  "code": 200,
  "msg": "支付成功",
  "data": {
    "callback_url": "https://example.com/callback?params..."
  }
}
```

## 微信扫码支付页面接口

### 接口说明
微信扫码支付页面，用于展示微信支付二维码。

### 请求URL

1. 原生接口：`GET {payUrl}/pay/wxpay/native`
2. 易支付兼容接口：`GET {payUrl}/pay/wxpay/native` (与原生接口相同)

### 请求参数
| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| cr | string | 是 | 经过base64编码的支付二维码URL |
| out_trade_no | string | 是 | 订单ID |
| ua | string | 否 | 用户代理标识，mobile或pc |

### 响应说明
返回微信支付二维码页面。

## 跳转接口

### 接口说明
通用跳转接口，用于跳转到指定页面。

### 请求URL

1. 原生接口：`GET {payUrl}/go`
2. 易支付兼容接口：`GET {payUrl}/go` (与原生接口相同)

### 请求参数
| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| url | string | 是 | 跳转URL，可以是base64编码的URL |
| type | string | 否 | URL类型，base64表示经过base64编码 |

### 响应说明
跳转到指定页面。

## 首页接口

### 接口说明
系统首页页面。

### 请求URL

1. 原生接口：`GET {payUrl}/`
2. 易支付兼容接口：`GET {payUrl}/` (与原生接口相同)

### 响应说明
返回系统首页页面。

## 测试接口

### 接口说明
系统测试接口。

### 请求URL

1. 原生接口：`GET {payUrl}/test`
2. 易支付兼容接口：`GET {payUrl}/test` (与原生接口相同)

### 响应说明
返回测试字符串"1"。

## 公共响应格式

### 成功响应
```json
{
  "code": 200,
  "msg": "成功信息",
  "data": {}
}
```

### 错误响应
```json
{
  "code": 错误码,
  "msg": "错误信息"
}
```

### 常见错误码
| 错误码 | 说明 |
| --- | --- |
| 200 | 成功 |
| 403 | 参数错误或签名验证失败 |
| 404 | 未找到支付渠道 |
| 500 | 系统错误 |

## 签名算法

### 签名生成步骤
1. 过滤掉sign和sign_type参数
2. 对参数按key进行ASCII码升序排序
3. 将排序后的参数按key=value的格式拼接成字符串
4. 在字符串末尾拼接商户密钥
5. 对拼接后的字符串进行MD5加密，得到签名

### 签名验证步骤
1. 获取请求中的sign参数
2. 按照签名生成步骤生成本地签名
3. 比较两个签名是否一致

### 示例
假设参数如下：
```
pid=10001
type=alipay
out_trade_no=20231001001
name=测试商品
money=100.00
```
商户密钥为：`XM9b0ce7BE6R9NQ897B0wW0LW031B182`

签名过程：
1. 过滤参数后得到：`money=100.00`, `name=测试商品`, `out_trade_no=20231001001`, `pid=10001`, `type=alipay`
2. 按key排序：`money=100.00`, `name=测试商品`, `out_trade_no=20231001001`, `pid=10001`, `type=alipay`
3. 拼接字符串：`money=100.00&name=测试商品&out_trade_no=20231001001&pid=10001&type=alipay`
4. 拼接密钥：`money=100.00&name=测试商品&out_trade_no=20231001001&pid=10001&type=alipayXM9b0ce7BE6R9NQ897B0wW0LW031B182`
5. MD5加密得到签名

## 数据库结构

### 订单表(gopay_order)
| 字段名 | 类型 | 说明 |
| --- | --- | --- |
| id | VARCHAR(40) | 主键，系统生成的订单ID |
| out_trade_no | VARCHAR | 商户订单号 |
| notify_url | VARCHAR | 异步通知地址 |
| return_url | VARCHAR | 同步跳转地址 |
| type | VARCHAR(10) | 支付方式(alipay/wxpay) |
| pid | INTEGER | 商户PID |
| title | VARCHAR | 商品名称 |
| money | VARCHAR | 金额 |
| status | INTEGER | 订单状态(0:未支付, 1:已支付) |
| attach | VARCHAR | 附加信息 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

## 支付流程说明

### 支付宝支付流程
1. 商户调用submit.php接口发起支付
2. 系统验证参数和签名
3. 跳转到支付宝支付页面
4. 用户完成支付后，支付宝异步通知/pay/alipay_notify
5. 系统更新订单状态并通知商户
6. 用户同步跳转到/pay/alipay_return
7. 系统跳转到商户指定页面

### 微信支付流程
1. 商户调用submit.php接口发起支付
2. 系统验证参数和签名
3. 调用微信支付API生成支付二维码或跳转到H5支付页面
4. 用户完成支付后，微信异步通知/pay/wxpay_notify/{appid}
5. 系统更新订单状态并通知商户
6. 用户扫码支付后跳转到指定页面

## 配置说明

### 商户配置
在config.js中配置商户信息：
```javascript
user: {
  10001: {
    key: 'XM9b0ce7BE6R9NQ897B0wW0LW031B182',
  },
}
```

### 支付渠道配置
支持配置多个支付渠道实现负载均衡：
```javascript
alipay: [
  {
    appId: '2021000148698595',
    privateKey: '私钥内容',
    alipayPublicKey: '支付宝公钥',
  },
],
wxpay: [
  {
    appId: 'wx4d12fhry2123',
    mchid: '15207894366',
    privateKey: fs.readFileSync('./cert/wxpay/apiclient_key.pem'),
    serial: '6BA656D82349713BBF909D338A2C50056F745791',
    secret: '4izi9ldta1ib8q3iu74vxxxxxxxx',
    certs: {
      '36736A4D01F0056B033693E40B6DB995D2A9B6D1': fs.readFileSync('./cert/wxpay/wechatpay_36736A4D01F0056B033693E40B6DB995D2A9B6D1.pem'),
    },
    only_native: false,
  },
]
```