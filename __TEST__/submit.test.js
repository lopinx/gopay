// 支付提交接口测试
const { mockOrderData, mockUserData, generateTestSign } = require('./testUtils');

// Mock Fastify实例和插件
const mockAlipayPlugin = {
  newInstance: jest.fn()
};

const mockWxpayPlugin = {
  newInstance: jest.fn()
};

const mockUserPlugin = {
  getUser: jest.fn()
};

const mockRespPlugin = {
  EMPTY_PARAMS: (param) => ({ code: 403, msg: param + ' 参数不能为空' }),
  PID_ERROR: { code: 403, msg: 'PID不存在' },
  SIGN_ERROR: { code: 403, msg: '请求签名校验失败' },
  SYS_ERROR: (msg) => ({ code: 500, msg }),
  ALIPAY_NO: { code: 400, msg: '未配置 alipay 渠道信息' }
};

// Mock数据库
const mockOrderModel = {
  create: jest.fn()
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
  },
  checkSign: jest.fn().mockReturnValue(true),
  sortParams: (params) => params,
  filterParams: (params) => params,
  checkMobile: (ua) => ua && ua.includes('mobile')
};

const mockUuid = {
  v4: () => '12345678-1234-1234-1234-123456789012'
};

// Mock日志
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

// Mock视图渲染
const mockView = jest.fn();

// 加载路由处理函数
let submitHandler;

// 模拟Fastify应用实例
const mockFastify = {
  post: jest.fn((path, handler) => {
    if (path === '/submit.php') {
      submitHandler = handler;
    }
  }),
  alipay: mockAlipayPlugin,
  wxpay: mockWxpayPlugin,
  user: mockUserPlugin,
  resp: mockRespPlugin,
  db: mockDb,
  log: mockLogger,
  view: mockView
};

// 模拟工具模块
jest.mock('../utils/stringutils', () => mockStringUtils);
jest.mock('uuid', () => mockUuid);

// 加载路由模块
require('../routes/submit.js')(mockFastify, {
  web: {
    payUrl: 'http://localhost:3000'
  },
  form: {
    subject: {
      rewrite: true,
      text: ['测试商品1', '测试商品2']
    },
    body: {
      rewrite: true,
      text: ['测试描述1', '测试描述2']
    }
  }
});

describe('支付提交接口测试', () => {
  let mockAlipayInstance;
  let mockWxpayInstance;
  
  beforeEach(() => {
    // 清空所有mock函数的调用记录
    jest.clearAllMocks();
    
    // 创建模拟支付宝实例
    mockAlipayInstance = {
      appId: 'test_alipay_appid',
      exec: jest.fn().mockResolvedValue('https://alipay.com/pay/test')
    };
    
    // 创建模拟微信支付实例
    mockWxpayInstance = {
      getAppid: jest.fn().mockReturnValue('test_wxpay_appid'),
      isOnlyNavtive: jest.fn().mockReturnValue(false),
      formData: jest.fn().mockReturnValue({
        total: 10000,
        description: '测试商品',
        notify_url: 'http://localhost:3000/pay/wxpay_notify/test_wxpay_appid',
        out_trade_no: '12345678123412341234123456789012',
        payer_client_ip: '127.0.0.1'
      }),
      exec: jest.fn().mockResolvedValue({
        code_url: 'https://wxpay.com/pay/test',
        h5_url: 'https://wxpay.com/h5/pay/test'
      })
    };
    
    // 默认返回模拟的支付实例
    mockAlipayPlugin.newInstance.mockReturnValue(mockAlipayInstance);
    mockWxpayPlugin.newInstance.mockReturnValue(mockWxpayInstance);
    
    // 默认返回有效的用户数据
    mockUserPlugin.getUser.mockReturnValue(mockUserData('10001'));
    
    // 默认返回有效的签名验证
    mockStringUtils.checkSign.mockReturnValue(true);
    
    // 默认返回创建订单成功
    mockOrderModel.create.mockResolvedValue({
      id: '12345678123412341234123456789012',
      out_trade_no: 'OUT_TEST_123',
      notify_url: 'https://example.com/notify',
      return_url: 'https://example.com/return',
      type: 'alipay',
      pid: '10001',
      title: '测试商品',
      money: '100.00',
      status: 0
    });
  });

  describe('支付提交接口 /submit.php', () => {
    test('应该正确处理支付宝支付请求', async () => {
      // 准备测试数据
      const formData = {
        pid: '10001',
        type: 'alipay',
        out_trade_no: 'OUT_TEST_123',
        notify_url: 'https://example.com/notify',
        return_url: 'https://example.com/return',
        name: '测试商品',
        money: '100.00',
        sign: 'test_sign'
      };
      
      // 构造请求和响应对象
      const mockRequest = {
        body: formData,
        query: {},
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        ip: '127.0.0.1'
      };
      
      const mockReply = {
        view: mockView
      };
      
      // 执行处理函数
      const result = await submitHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(mockView).toHaveBeenCalledWith('/templates/submit.ejs', expect.objectContaining({
        payurl: expect.any(String),
        type: expect.any(String)
      }));
      
      // 验证调用
      expect(mockAlipayPlugin.newInstance).toHaveBeenCalled();
      expect(mockAlipayInstance.exec).toHaveBeenCalled();
      expect(mockOrderModel.create).toHaveBeenCalled();
    });
    
    test('应该正确处理微信支付扫码请求', async () => {
      // 准备测试数据
      const formData = {
        pid: '10001',
        type: 'wxpay',
        out_trade_no: 'OUT_TEST_123',
        notify_url: 'https://example.com/notify',
        return_url: 'https://example.com/return',
        name: '测试商品',
        money: '100.00',
        sign: 'test_sign'
      };
      
      // 构造请求和响应对象 (PC端)
      const mockRequest = {
        body: formData,
        query: {},
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        ip: '127.0.0.1'
      };
      
      const mockReply = {
        view: mockView
      };
      
      // 执行处理函数
      const result = await submitHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(mockView).toHaveBeenCalledWith('/templates/submit.ejs', expect.objectContaining({
        payurl: expect.any(String),
        type: 'base64'
      }));
      
      // 验证调用
      expect(mockWxpayPlugin.newInstance).toHaveBeenCalled();
      expect(mockWxpayInstance.formData).toHaveBeenCalledWith('native', expect.any(Object));
      expect(mockWxpayInstance.exec).toHaveBeenCalled();
      expect(mockOrderModel.create).toHaveBeenCalled();
    });
    
    test('应该正确处理微信支付H5请求', async () => {
      // 准备测试数据
      const formData = {
        pid: '10001',
        type: 'wxpay',
        out_trade_no: 'OUT_TEST_123',
        notify_url: 'https://example.com/notify',
        return_url: 'https://example.com/return',
        name: '测试商品',
        money: '100.00',
        sign: 'test_sign'
      };
      
      // 构造请求和响应对象 (移动端)
      const mockRequest = {
        body: formData,
        query: {},
        headers: {
          'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
        },
        ip: '127.0.0.1'
      };
      
      const mockReply = {
        view: mockView
      };
      
      // 执行处理函数
      const result = await submitHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(mockView).toHaveBeenCalledWith('/templates/submit.ejs', expect.objectContaining({
        payurl: expect.any(String),
        type: 'base64' // 微信支付H5也会返回base64编码的URL
      }));
      
      // 验证调用
      expect(mockWxpayPlugin.newInstance).toHaveBeenCalled();
      expect(mockWxpayInstance.formData).toHaveBeenCalledWith('h5', expect.any(Object));
      expect(mockWxpayInstance.exec).toHaveBeenCalled();
      expect(mockOrderModel.create).toHaveBeenCalled();
    });
    
    test('应该在缺少必要参数时返回错误', async () => {
      // 准备测试数据 (缺少type参数)
      const formData = {
        pid: '10001',
        out_trade_no: 'OUT_TEST_123',
        notify_url: 'https://example.com/notify',
        return_url: 'https://example.com/return',
        name: '测试商品',
        money: '100.00',
        sign: 'test_sign'
      };
      
      // 构造请求和响应对象
      const mockRequest = {
        body: formData,
        query: {},
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        ip: '127.0.0.1'
      };
      
      const mockReply = {
        view: mockView
      };
      
      // 执行处理函数
      const result = await submitHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(result).toEqual({
        code: 403,
        msg: 'type 参数不能为空'
      });
    });
    
    test('应该在签名验证失败时返回错误', async () => {
      // 模拟签名验证失败
      mockStringUtils.checkSign.mockReturnValue(false);
      
      // 准备测试数据
      const formData = {
        pid: '10001',
        type: 'alipay',
        out_trade_no: 'OUT_TEST_123',
        notify_url: 'https://example.com/notify',
        return_url: 'https://example.com/return',
        name: '测试商品',
        money: '100.00',
        sign: 'invalid_sign'
      };
      
      // 构造请求和响应对象
      const mockRequest = {
        body: formData,
        query: {},
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        ip: '127.0.0.1'
      };
      
      const mockReply = {
        view: mockView
      };
      
      // 执行处理函数
      const result = await submitHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(result).toEqual({
        code: 403,
        msg: '请求签名校验失败'
      });
    });
    
    test('应该在找不到用户时返回错误', async () => {
      // 模拟找不到用户
      mockUserPlugin.getUser.mockReturnValue(null);
      
      // 准备测试数据
      const formData = {
        pid: '99999',
        type: 'alipay',
        out_trade_no: 'OUT_TEST_123',
        notify_url: 'https://example.com/notify',
        return_url: 'https://example.com/return',
        name: '测试商品',
        money: '100.00',
        sign: 'test_sign'
      };
      
      // 构造请求和响应对象
      const mockRequest = {
        body: formData,
        query: {},
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        ip: '127.0.0.1'
      };
      
      const mockReply = {
        view: mockView
      };
      
      // 执行处理函数
      const result = await submitHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(result).toEqual({
        code: 403,
        msg: 'PID不存在'
      });
    });
    
    test('应该在支付宝未配置时返回错误', async () => {
      // 模拟支付宝未配置
      mockAlipayPlugin.newInstance.mockReturnValue(null);
      
      // 准备测试数据
      const formData = {
        pid: '10001',
        type: 'alipay',
        out_trade_no: 'OUT_TEST_123',
        notify_url: 'https://example.com/notify',
        return_url: 'https://example.com/return',
        name: '测试商品',
        money: '100.00',
        sign: 'test_sign'
      };
      
      // 构造请求和响应对象
      const mockRequest = {
        body: formData,
        query: {},
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        ip: '127.0.0.1'
      };
      
      const mockReply = {
        view: mockView
      };
      
      // 执行处理函数
      const result = await submitHandler(mockRequest, mockReply);
      
      // 验证结果
      expect(result).toEqual({
        code: 400,
        msg: '未配置 alipay 渠道信息'
      });
    });
  });
});