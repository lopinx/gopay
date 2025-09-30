// 支付插件测试

// Mock支付宝SDK
const mockAlipaySdk = {
  default: jest.fn().mockImplementation(() => {
    return {
      exec: jest.fn().mockResolvedValue('https://alipay.com/pay/test'),
      checkNotifySign: jest.fn().mockReturnValue(true)
    };
  }),
  AlipayFormData: jest.fn().mockImplementation(() => {
    return {
      setMethod: jest.fn(),
      addField: jest.fn()
    };
  })
};

jest.mock('alipay-sdk', () => mockAlipaySdk);

// Mock微信支付SDK
const mockWechatPay = jest.fn().mockImplementation(() => {
  return {
    transactions_h5: jest.fn().mockResolvedValue({
      h5_url: 'https://wxpay.com/h5/pay/test'
    }),
    transactions_native: jest.fn().mockResolvedValue({
      code_url: 'https://wxpay.com/pay/test'
    }),
    verifySign: jest.fn().mockResolvedValue(true),
    decipher_gcm: jest.fn().mockResolvedValue(JSON.stringify({
      out_trade_no: 'test_order_123',
      trade_state: 'SUCCESS'
    }))
  };
});

jest.mock('wechatpay-node-v3', () => mockWechatPay);

// Mock Fastify插件
const fp = require('fastify-plugin');
jest.mock('fastify-plugin', () => {
  return jest.fn().mockImplementation((fn) => fn);
});

// Mock日志
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

// Mock文件系统
const mockFs = {
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('test_cert_content')
};

jest.mock('fs', () => mockFs);

describe('支付插件测试', () => {
  beforeEach(() => {
    // 清空所有mock函数的调用记录
    jest.clearAllMocks();
  });

  describe('支付宝插件测试', () => {
    let mockFastify;
    let alipayPlugin;
    
    beforeEach(() => {
      // 创建模拟Fastify实例
      mockFastify = {
        decorate: jest.fn(),
        log: mockLogger
      };
      
      // 重新加载支付宝插件
      delete require.cache[require.resolve('../plugins/alipay.js')];
      alipayPlugin = require('../plugins/alipay.js');
    });
    
    test('应该正确初始化支付宝插件', async () => {
      // 执行插件
      await alipayPlugin(mockFastify, {
        alipay: [
          {
            appId: 'test_appid',
            privateKey: 'test_private_key',
            alipayPublicKey: 'test_public_key'
          }
        ]
      });
      
      // 验证插件被正确装饰
      expect(mockFastify.decorate).toHaveBeenCalledWith('alipay', expect.objectContaining({
        newInstance: expect.any(Function)
      }));
    });
    
    test('应该正确创建支付宝实例', async () => {
      // 执行插件
      await alipayPlugin(mockFastify, {
        alipay: [
          {
            appId: 'test_appid',
            privateKey: 'test_private_key',
            alipayPublicKey: 'test_public_key'
          }
        ]
      });
      
      // 获取装饰的alipay对象
      const alipayDecorator = mockFastify.decorate.mock.calls[0][1];
      
      // 创建支付宝实例
      const alipayInstance = alipayDecorator.newInstance();
      
      // 验证实例创建成功
      expect(alipayInstance).toBeDefined();
      expect(alipayInstance.appId).toBe('test_appid');
    });
    
    test('应该在配置为空时返回null', async () => {
      // 执行插件
      await alipayPlugin(mockFastify, {
        alipay: []
      });
      
      // 获取装饰的alipay对象
      const alipayDecorator = mockFastify.decorate.mock.calls[0][1];
      
      // 创建支付宝实例
      const alipayInstance = alipayDecorator.newInstance();
      
      // 验证返回null
      expect(alipayInstance).toBeNull();
    });
    
    test('应该过滤掉appid为空的配置', async () => {
      // 执行插件
      await alipayPlugin(mockFastify, {
        alipay: [
          {
            appId: '', // 空appid
            privateKey: 'test_private_key',
            alipayPublicKey: 'test_public_key'
          },
          {
            appId: 'test_appid',
            privateKey: 'test_private_key',
            alipayPublicKey: 'test_public_key'
          }
        ]
      });
      
      // 获取装饰的alipay对象
      const alipayDecorator = mockFastify.decorate.mock.calls[0][1];
      
      // 创建支付宝实例
      const alipayInstance = alipayDecorator.newInstance();
      
      // 验证使用了有效的配置
      expect(alipayInstance).toBeDefined();
      expect(alipayInstance.appId).toBe('test_appid');
    });
  });
  
  describe('微信支付插件测试', () => {
    let mockFastify;
    let wxpayPlugin;
    
    beforeEach(() => {
      // 创建模拟Fastify实例
      mockFastify = {
        decorate: jest.fn(),
        log: mockLogger
      };
      
      // 重新加载微信支付插件
      delete require.cache[require.resolve('../plugins/wxpay.js')];
      wxpayPlugin = require('../plugins/wxpay.js');
    });
    
    test('应该正确初始化微信支付插件', async () => {
      // 执行插件
      await wxpayPlugin(mockFastify, {
        wxpay: [
          {
            appId: 'test_appid',
            mchid: 'test_mchid',
            privateKey: 'test_private_key',
            secret: 'test_secret',
            serial: 'test_serial',
            certs: {
              'test_serial': 'test_cert'
            }
          }
        ]
      });
      
      // 验证插件被正确装饰
      expect(mockFastify.decorate).toHaveBeenCalledWith('wxpay', expect.objectContaining({
        newInstance: expect.any(Function)
      }));
    });
    
    test('应该正确创建微信支付实例', async () => {
      // 执行插件
      await wxpayPlugin(mockFastify, {
        wxpay: [
          {
            appId: 'test_appid',
            mchid: 'test_mchid',
            privateKey: 'test_private_key',
            secret: 'test_secret',
            serial: 'test_serial',
            certs: {
              'test_serial': 'test_cert'
            }
          }
        ]
      });
      
      // 获取装饰的wxpay对象
      const wxpayDecorator = mockFastify.decorate.mock.calls[0][1];
      
      // 创建微信支付实例
      const wxpayInstance = wxpayDecorator.newInstance();
      
      // 验证实例创建成功
      expect(wxpayInstance).toBeDefined();
      expect(wxpayInstance.getAppid()).toBe('test_appid');
    });
    
    test('应该在配置为空时返回null', async () => {
      // 执行插件
      await wxpayPlugin(mockFastify, {
        wxpay: []
      });
      
      // 获取装饰的wxpay对象
      const wxpayDecorator = mockFastify.decorate.mock.calls[0][1];
      
      // 创建微信支付实例
      const wxpayInstance = wxpayDecorator.newInstance();
      
      // 验证返回null
      expect(wxpayInstance).toBeNull();
    });
    
    test('应该过滤掉appid为空的配置', async () => {
      // 执行插件
      await wxpayPlugin(mockFastify, {
        wxpay: [
          {
            appId: '', // 空appid
            mchid: 'test_mchid',
            privateKey: 'test_private_key',
            secret: 'test_secret',
            serial: 'test_serial',
            certs: {
              'test_serial': 'test_cert'
            }
          },
          {
            appId: 'test_appid',
            mchid: 'test_mchid',
            privateKey: 'test_private_key',
            secret: 'test_secret',
            serial: 'test_serial',
            certs: {
              'test_serial': 'test_cert'
            }
          }
        ]
      });
      
      // 获取装饰的wxpay对象
      const wxpayDecorator = mockFastify.decorate.mock.calls[0][1];
      
      // 创建微信支付实例
      const wxpayInstance = wxpayDecorator.newInstance();
      
      // 验证使用了有效的配置
      expect(wxpayInstance).toBeDefined();
      expect(wxpayInstance.getAppid()).toBe('test_appid');
    });
    
    test('应该正确生成支付表单数据', async () => {
      // 执行插件
      await wxpayPlugin(mockFastify, {
        wxpay: [
          {
            appId: 'test_appid',
            mchid: 'test_mchid',
            privateKey: 'test_private_key',
            secret: 'test_secret',
            serial: 'test_serial',
            certs: {
              'test_serial': 'test_cert'
            }
          }
        ]
      });
      
      // 获取装饰的wxpay对象
      const wxpayDecorator = mockFastify.decorate.mock.calls[0][1];
      
      // 创建微信支付实例
      const wxpayInstance = wxpayDecorator.newInstance();
      
      // 生成表单数据
      const formData = wxpayInstance.formData('native', {
        out_trade_no: 'test_order_123',
        total: 10000,
        description: '测试商品'
      });
      
      // 验证表单数据
      expect(formData).toEqual({
        description: '测试商品',
        out_trade_no: 'test_order_123',
        amount: {
          total: 10000,
          currency: 'CNY'
        },
        notify_url: undefined
      });
    });
  });
});