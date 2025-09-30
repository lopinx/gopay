// 测试工具函数和模拟数据

// 生成测试用的订单ID
const generateTestOrderId = () => {
  return 'TEST_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// 生成测试用的用户PID
const generateTestPid = () => {
  return Math.floor(10000 + Math.random() * 90000).toString();
};

// 生成测试用的签名
const generateTestSign = (params, key) => {
  const crypto = require('crypto');
  
  // 过滤并排序参数
  const filteredParams = {};
  Object.keys(params).forEach(key => {
    if (key !== 'sign' && key !== 'sign_type' && params[key] !== '') {
      filteredParams[key] = params[key];
    }
  });
  
  // 排序参数
  const sortedKeys = Object.keys(filteredParams).sort();
  let paramString = '';
  sortedKeys.forEach(key => {
    paramString += key + '=' + filteredParams[key] + '&';
  });
  paramString = paramString.slice(0, -1); // 移除最后一个&
  
  // 生成MD5签名
  return crypto.createHash('md5').update(paramString + key.trim()).digest('hex');
};

// 模拟支付宝回调数据
const mockAlipayNotifyData = (overrides = {}) => {
  return {
    app_id: '2019093330229234',
    out_trade_no: generateTestOrderId(),
    trade_no: '2023040522001234567890',
    trade_status: 'TRADE_SUCCESS',
    total_amount: '100.00',
    ...overrides
  };
};

// 模拟微信支付回调数据
const mockWxpayNotifyData = (overrides = {}) => {
  return {
    id: 'bbd51dad-5b3e-56da-b848-3b0c48b8b69a',
    create_time: '2021-03-30T23:23:37+08:00',
    resource_type: 'encrypt-resource',
    event_type: 'TRANSACTION.SUCCESS',
    summary: '支付成功',
    resource: {
      original_type: 'transaction',
      algorithm: 'AEAD_AES_256_GCM',
      ciphertext: 'test_ciphertext',
      associated_data: 'transaction',
      nonce: 'test_nonce',
    },
    ...overrides
  };
};

// 模拟用户数据
const mockUserData = (pid, overrides = {}) => {
  return {
    key: 'test_user_key_' + pid,
    ...overrides
  };
};

// 模拟订单数据
const mockOrderData = (overrides = {}) => {
  const orderId = generateTestOrderId();
  return {
    id: orderId,
    out_trade_no: 'OUT_' + orderId,
    notify_url: 'https://example.com/notify',
    return_url: 'https://example.com/return',
    type: 'alipay',
    pid: generateTestPid(),
    title: '测试商品',
    money: '100.00',
    status: 0,
    ...overrides
  };
};

module.exports = {
  generateTestOrderId,
  generateTestPid,
  generateTestSign,
  mockAlipayNotifyData,
  mockWxpayNotifyData,
  mockUserData,
  mockOrderData
};