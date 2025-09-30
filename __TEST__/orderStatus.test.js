// 订单状态查询接口测试
const { mockOrderData, mockUserData, generateTestSign } = require('./testUtils');

// Mock Fastify实例和插件
const mockUserPlugin = {
  getUser: jest.fn()
};

const mockRespPlugin = {
  EMPTY_PARAMS: (param) => ({ code: 403, msg: param + ' 参数不能为空' }),
  SYS_ERROR: (msg) => ({ code: 500, msg }),
  RESP_OK: (msg, data) => ({ code: 200, msg, data }),
  RESP_FAIL: (code, msg, data) => ({ code, msg, data: data || {} })
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

// Mock工具函数
const mockStringUtils = {
  isEmpty: (value) => {
    return value === undefined || value === null || value === '';
  }
};

const mockEpayUtils = {
  buildPayReturnCallbackUrl: jest.fn().mockReturnValue('https://example.com/return')
};

// Mock日志
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

// 加载路由处理函数
let orderStatusHandler;
let testHandler;

// 模拟Fastify应用实例
const mockFastify = {
  get: jest.fn((path, handler) => {
    if (path === '/api/order_status') {
      orderStatusHandler = handler;
    } else if (path === '/test') {
      testHandler = handler;
    }
  }),
  user: mockUserPlugin,
  resp: mockRespPlugin,
  db: mockDb,
  log: mockLogger
};

// 模拟工具模块
jest.mock('../utils/stringutils', () => mockStringUtils);
jest.mock('../utils/epayutils', () => mockEpayUtils);

// 加载路由模块
require('../routes/order.js')(mockFastify, {});

describe('订单状态查询接口测试', () => {
  beforeEach(() => {
    // 清空所有mock函数的调用记录
    jest.clearAllMocks();
    
    // 默认返回有效的用户数据
    mockUserPlugin.getUser.mockReturnValue(mockUserData('10001'));
    
    // 默认返回回调URL
    mockEpayUtils.buildPayReturnCallbackUrl.mockReturnValue('https://example.com/return');
  });

  describe('订单状态查询接口 /api/order_status', () => {
    test('应该正确返回已支付订单的状态', async () => {
      // 准备测试数据
      const orderId = 'test_order_123';
      
      // 模拟订单查找
      const mockOrder = {
        id: orderId,
        pid: '10001',
        status: 1, // 已支付
        out_trade_no: 'OUT_' + orderId,
        notify_url: 'https://example.com/notify',
        return_url: 'https://example.com/return',
        type: 'alipay',
        title: '测试商品',
        money: '100.00'
      };
      mockOrderModel.findOne.mockResolvedValue(mockOrder);
      
      // 构造请求和响应对象
      const mockRequest = {
        query: {
          out_trade_no: orderId,
          type: 'alipay'
        }
      };
      
      const mockReply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      
      // 执行处理函数
      const result = await orderStatusHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(result).toEqual({
        code: 200,
        msg: '支付成功',
        data: {
          callback_url: 'https://example.com/return'
        }
      });
      
      // 验证调用
      expect(mockOrderModel.findOne).toHaveBeenCalledWith({
        where: { id: orderId }
      });
      expect(mockUserPlugin.getUser).toHaveBeenCalledWith('10001');
      expect(mockEpayUtils.buildPayReturnCallbackUrl).toHaveBeenCalledWith(
        mockOrder,
        null,
        mockUserData('10001').key
      );
    });
    
    test('应该正确返回未支付订单的状态', async () => {
      // 准备测试数据
      const orderId = 'test_order_123';
      
      // 模拟订单查找
      const mockOrder = {
        id: orderId,
        pid: '10001',
        status: 0, // 未支付
        out_trade_no: 'OUT_' + orderId,
        notify_url: 'https://example.com/notify',
        return_url: 'https://example.com/return',
        type: 'alipay',
        title: '测试商品',
        money: '100.00'
      };
      mockOrderModel.findOne.mockResolvedValue(mockOrder);
      
      // 构造请求和响应对象
      const mockRequest = {
        query: {
          out_trade_no: orderId,
          type: 'alipay'
        }
      };
      
      const mockReply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      
      // 执行处理函数
      const result = await orderStatusHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(result).toEqual({
        code: 300,
        msg: '当前订单尚未支付',
        data: {}
      });
    });
    
    test('应该在缺少订单号时返回参数错误', async () => {
      // 构造请求和响应对象
      const mockRequest = {
        query: {
          type: 'alipay'
        }
      };
      
      const mockReply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      
      // 执行处理函数
      const result = await orderStatusHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(result).toEqual({
        code: 403,
        msg: 'Params 参数不能为空'
      });
    });
    
    test('应该在找不到订单时返回错误', async () => {
      // 准备测试数据
      const orderId = 'test_order_123';
      
      // 模拟找不到订单
      mockOrderModel.findOne.mockResolvedValue(null);
      
      // 构造请求和响应对象
      const mockRequest = {
        query: {
          out_trade_no: orderId,
          type: 'alipay'
        }
      };
      
      const mockReply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      
      // 执行处理函数
      const result = await orderStatusHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(result).toEqual({
        code: 500,
        msg: '订单不存在'
      });
    });
    
    test('应该在找不到用户时返回错误', async () => {
      // 准备测试数据
      const orderId = 'test_order_123';
      
      // 模拟订单查找
      const mockOrder = {
        id: orderId,
        pid: '10001',
        status: 1, // 已支付
        out_trade_no: 'OUT_' + orderId,
        notify_url: 'https://example.com/notify',
        return_url: 'https://example.com/return',
        type: 'alipay',
        title: '测试商品',
        money: '100.00'
      };
      mockOrderModel.findOne.mockResolvedValue(mockOrder);
      
      // 模拟找不到用户
      mockUserPlugin.getUser.mockReturnValue(null);
      
      // 构造请求和响应对象
      const mockRequest = {
        query: {
          out_trade_no: orderId,
          type: 'alipay'
        }
      };
      
      const mockReply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      
      // 执行处理函数
      const result = await orderStatusHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(result).toEqual({
        code: 500,
        msg: 'PID不存在，无法查询，请以实际到账为准'
      });
    });
  });
  
  describe('测试接口 /test', () => {
    test('应该返回字符串"1"', async () => {
      // 构造请求和响应对象
      const mockRequest = {};
      const mockReply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      
      // 执行处理函数
      const result = await testHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(result).toBe('1');
    });
  });
});