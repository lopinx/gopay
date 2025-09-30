// 核心功能测试

describe('核心功能测试', () => {
  test('应该能够正确导入和使用工具函数', () => {
    // 测试字符串工具函数
    const stringUtils = require('../utils/stringutils');
    expect(stringUtils).toBeDefined();
    expect(typeof stringUtils.isEmpty).toBe('function');
    expect(typeof stringUtils.checkSign).toBe('function');
    
    // 测试isEmpty函数
    expect(stringUtils.isEmpty(null)).toBe(true);
    expect(stringUtils.isEmpty(undefined)).toBe(true);
    expect(stringUtils.isEmpty('')).toBe(true);
    expect(stringUtils.isEmpty('test')).toBe(false);
  });
  
  test('应该能够正确导入和使用支付工具函数', () => {
    // 测试支付工具函数
    const epayUtils = require('../utils/epayutils');
    expect(epayUtils).toBeDefined();
    expect(typeof epayUtils.buildPayNotifyCallbackUrl).toBe('function');
    expect(typeof epayUtils.buildPayReturnCallbackUrl).toBe('function');
  });
  
  test('应该能够正确导入配置文件', () => {
    // 测试配置文件
    const config = require('../config')();
    expect(config).toBeDefined();
    expect(config.web).toBeDefined();
    expect(config.user).toBeDefined();
    expect(config.alipay).toBeDefined();
    expect(config.wxpay).toBeDefined();
  });
});