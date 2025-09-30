// 微信支付回调接口测试
const { mockWxpayNotifyData, mockOrderData, mockUserData } = require('./testUtils');

// Mock WechatPay类
const WechatPay = require('wechatpay-node-v3');
jest.mock('wechatpay-node-v3');

// Mock Fastify实例和插件
const mockWxpayPlugin = {
  newInstance: jest.fn()
};

const mockUserPlugin = {
  getUser: jest.fn()
};

const mockRespPlugin = {
  WXPAY_OK: { code: 'SUCCESS', message: '成功' },
  WXPAY_FAIL: { code: 'FAIL', message: '失败' },
  SYS_ERROR: (msg) => ({ code: 500, msg }),
  EMPTY_PARAMS: (param) => ({ code: 403, msg: param + ' 参数不能为空' })
};

// Mock数据库
const mockOrderModel = {
  findOne: jest.fn()
};

const mockDb = {
  models: {
    Order: mockOrderModel
  }
};

// Mock axios
const mockAxios = {
  get: jest.fn()
};

// Mock日志
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

// 加载路由处理函数
let wxpayNotifyHandler;

// 模拟Fastify应用实例
const mockFastify = {
  post: jest.fn((path, handler) => {
    if (path === '/pay/wxpay_notify/:appid') {
      wxpayNotifyHandler = handler;
    }
  }),
  wxpay: mockWxpayPlugin,
  user: mockUserPlugin,
  resp: mockRespPlugin,
  db: mockDb,
  axios: mockAxios,
  log: mockLogger
};

// 加载路由模块
require('../routes/pay/wechat/notify.js')(mockFastify, {});

describe('微信支付回调接口测试', () => {
  let mockWxpayInstance;
  
  beforeEach(() => {
    // 清空所有mock函数的调用记录
    jest.clearAllMocks();
    
    // 创建模拟微信支付实例
    mockWxpayInstance = {
      verifySignature: jest.fn().mockResolvedValue(true),
      decryptNotifyData: jest.fn().mockResolvedValue(JSON.stringify({
        out_trade_no: 'test_order_123',
        trade_state: 'SUCCESS'
      }))
    };
    
    // 默认返回模拟的微信支付实例
    mockWxpayPlugin.newInstance.mockReturnValue(mockWxpayInstance);
    
    // 默认返回有效的用户数据
    mockUserPlugin.getUser.mockReturnValue(mockUserData('10001'));
    
    // 默认返回成功的HTTP请求
    mockAxios.get.mockResolvedValue({ data: 'success', status: 200 });
  });

  describe('微信支付异步通知接口 /pay/wxpay_notify/:appid', () => {
    test('应该正确处理支付成功的回调', async () => {
      // 准备测试数据
      const notifyData = mockWxpayNotifyData({
        event_type: 'TRANSACTION.SUCCESS'
      });
      
      // 模拟订单查找
      const mockOrder = {
        id: 'test_order_123',
        pid: '10001',
        status: 0,
        save: jest.fn()
      };
      mockOrderModel.findOne.mockResolvedValue(mockOrder);
      
      // 构造请求和响应对象
      const mockRequest = {
        body: notifyData,
        headers: {},
        params: {
          appid: 'test_appid'
        }
      };
      
      const mockReply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      
      // 执行处理函数
      const result = await wxpayNotifyHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(result).toEqual({ code: 'SUCCESS', message: '成功' });
      
      // 验证调用
      expect(mockWxpayPlugin.newInstance).toHaveBeenCalledWith('test_appid');
      expect(mockWxpayInstance.verifySignature).toHaveBeenCalledWith({}, notifyData);
      expect(mockWxpayInstance.decryptNotifyData).toHaveBeenCalledWith(
        notifyData.resource.associated_data,
        notifyData.resource.nonce,
        notifyData.resource.ciphertext
      );
      expect(mockOrderModel.findOne).toHaveBeenCalledWith({
        where: { id: 'test_order_123' }
      });
      expect(mockOrder.save).toHaveBeenCalled();
      expect(mockUserPlugin.getUser).toHaveBeenCalledWith('10001');
      expect(mockAxios.get).toHaveBeenCalled();
    });
    
    test('应该在缺少event_type时返回错误', async () => {
      // 构造请求和响应对象
      const mockRequest = {
        body: {},
        headers: {},
        params: {
          appid: 'test_appid'
        }
      };
      
      const mockReply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      
      // 执行处理函数
      const result = await wxpayNotifyHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith('缺少事件类型参数');
    });
    
    test('应该在缺少appid时返回错误', async () => {
      // 构造请求和响应对象
      const mockRequest = {
        body: {
          event_type: 'TRANSACTION.SUCCESS'
        },
        headers: {},
        params: {}
      };
      
      const mockReply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      
      // 执行处理函数
      const result = await wxpayNotifyHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith('缺少appid参数');
    });
    
    test('应该正确处理非成功交易通知', async () => {
      // 准备测试数据
      const notifyData = mockWxpayNotifyData({
        event_type: 'TRANSACTION.FAIL'
      });
      
      // 构造请求和响应对象
      const mockRequest = {
        body: notifyData,
        headers: {},
        params: {
          appid: 'test_appid'
        }
      };
      
      const mockReply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      
      // 执行处理函数
      const result = await wxpayNotifyHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(result).toEqual({ code: 'SUCCESS', message: '成功' });
    });
    
    test('应该在找不到微信支付实例时返回错误', async () => {
      // 模拟找不到微信支付实例
      mockWxpayPlugin.newInstance.mockReturnValue(null);
      
      // 准备测试数据
      const notifyData = mockWxpayNotifyData({
        event_type: 'TRANSACTION.SUCCESS'
      });
      
      // 构造请求和响应对象
      const mockRequest = {
        body: notifyData,
        headers: {},
        params: {
          appid: 'test_appid'
        }
      };
      
      const mockReply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      
      // 执行处理函数
      const result = await wxpayNotifyHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(mockReply.code).toHaveBeenCalledWith(402);
      expect(mockReply.send).toHaveBeenCalledWith('appid NotFound');
    });
    
    test('应该在签名验证失败时返回错误', async () => {
      // 模拟签名验证失败
      mockWxpayInstance.verifySignature.mockResolvedValue(false);
      
      // 准备测试数据
      const notifyData = mockWxpayNotifyData({
        event_type: 'TRANSACTION.SUCCESS'
      });
      
      // 构造请求和响应对象
      const mockRequest = {
        body: notifyData,
        headers: {},
        params: {
          appid: 'test_appid'
        }
      };
      
      const mockReply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      
      // 执行处理函数
      const result = await wxpayNotifyHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith('签名验证失败');
    });
  });
});