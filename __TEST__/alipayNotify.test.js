// 支付宝回调接口测试
const { mockAlipayNotifyData, generateTestSign, mockUserData } = require('./testUtils');

// Mock Fastify实例和插件
const mockAlipayPlugin = {
  checkNotifySign: jest.fn().mockReturnValue(true)
};

const mockUserPlugin = {
  getUser: jest.fn().mockReturnValue(mockUserData('10001'))
};

const mockRespPlugin = {
  ALIPAY_OK: 'success',
  ALIPAY_FAIL: 'fail',
  SIGN_ERROR: { code: 403, msg: '请求签名校验失败' },
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
let alipayNotifyHandler;
let alipayReturnHandler;

// 模拟Fastify应用实例
const mockFastify = {
  post: jest.fn((path, handler) => {
    if (path === '/pay/alipay_notify') {
      alipayNotifyHandler = handler;
    }
  }),
  get: jest.fn((path, handler) => {
    if (path === '/pay/alipay_return') {
      alipayReturnHandler = handler;
    }
  }),
  alipay: mockAlipayPlugin,
  user: mockUserPlugin,
  resp: mockRespPlugin,
  db: mockDb,
  axios: mockAxios,
  log: mockLogger
};

// 加载路由模块
require('../routes/pay/alipay/notify.js')(mockFastify, {});

describe('支付宝回调接口测试', () => {
  beforeEach(() => {
    // 清空所有mock函数的调用记录
    jest.clearAllMocks();
    
    // 默认返回成功的签名验证
    mockAlipayPlugin.checkNotifySign.mockReturnValue(true);
    
    // 默认返回有效的用户数据
    mockUserPlugin.getUser.mockReturnValue(mockUserData('10001'));
    
    // 默认返回成功的HTTP请求
    mockAxios.get.mockResolvedValue({ data: 'success', status: 200 });
  });

  describe('支付宝异步通知接口 /pay/alipay_notify', () => {
    test('应该正确处理支付成功的回调', async () => {
      // 准备测试数据
      const notifyData = mockAlipayNotifyData({
        trade_status: 'TRADE_SUCCESS'
      });
      
      const sign = generateTestSign(notifyData, mockUserData('10001').key);
      notifyData.sign = sign;
      
      // 模拟订单查找
      const mockOrder = {
        id: notifyData.out_trade_no,
        pid: '10001',
        status: 0,
        save: jest.fn()
      };
      mockOrderModel.findOne.mockResolvedValue(mockOrder);
      
      // 构造请求和响应对象
      const mockRequest = {
        body: notifyData
      };
      
      const mockReply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      
      // 执行处理函数
      const result = await alipayNotifyHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(result).toBe('success');
      
      // 验证调用
      expect(mockAlipayPlugin.checkNotifySign).toHaveBeenCalledWith(notifyData);
      expect(mockOrderModel.findOne).toHaveBeenCalledWith({
        where: { out_trade_no: notifyData.out_trade_no }
      });
      expect(mockOrder.save).toHaveBeenCalled();
      expect(mockUserPlugin.getUser).toHaveBeenCalledWith('10001');
      expect(mockAxios.get).toHaveBeenCalled();
    });
    
    test('应该正确处理交易完成的回调', async () => {
      // 准备测试数据
      const notifyData = mockAlipayNotifyData({
        trade_status: 'TRADE_FINISHED'
      });
      
      // 构造请求和响应对象
      const mockRequest = {
        body: notifyData
      };
      
      const mockReply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      
      // 执行处理函数
      const result = await alipayNotifyHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(result).toBe('success');
    });
    
    test('应该在缺少app_id时返回失败', async () => {
      // 准备测试数据
      const notifyData = mockAlipayNotifyData();
      delete notifyData.app_id; // 删除app_id
      
      // 构造请求和响应对象
      const mockRequest = {
        body: notifyData
      };
      
      const mockReply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      
      // 执行处理函数
      const result = await alipayNotifyHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(result).toBe('fail');
    });
    
    test('应该在缺少out_trade_no时返回失败', async () => {
      // 准备测试数据
      const notifyData = mockAlipayNotifyData();
      delete notifyData.out_trade_no; // 删除out_trade_no
      
      // 构造请求和响应对象
      const mockRequest = {
        body: notifyData
      };
      
      const mockReply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      
      // 执行处理函数
      const result = await alipayNotifyHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(result).toBe('fail');
    });
    
    test('应该在签名验证失败时返回签名错误', async () => {
      // 准备测试数据
      const notifyData = mockAlipayNotifyData();
      const sign = generateTestSign(notifyData, mockUserData('10001').key);
      notifyData.sign = sign;
      
      // 模拟签名验证失败
      mockAlipayPlugin.checkNotifySign.mockReturnValue(false);
      
      // 构造请求和响应对象
      const mockRequest = {
        body: notifyData
      };
      
      const mockReply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      
      // 执行处理函数
      const result = await alipayNotifyHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(result).toEqual({ code: 403, msg: '请求签名校验失败' });
    });
    
    test('应该在找不到订单时返回失败', async () => {
      // 准备测试数据
      const notifyData = mockAlipayNotifyData();
      const sign = generateTestSign(notifyData, mockUserData('10001').key);
      notifyData.sign = sign;
      
      // 模拟找不到订单
      mockOrderModel.findOne.mockResolvedValue(null);
      
      // 构造请求和响应对象
      const mockRequest = {
        body: notifyData
      };
      
      const mockReply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      
      // 执行处理函数
      const result = await alipayNotifyHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(result).toBe('success'); // 应该返回success以避免重复通知
    });
  });
});