// 数据库插件测试
const { Sequelize } = require('sequelize');

// Mock Sequelize
const mockSequelize = {
  define: jest.fn().mockReturnValue({
    sync: jest.fn().mockResolvedValue()
  }),
  authenticate: jest.fn().mockResolvedValue(),
  getQueryInterface: jest.fn().mockReturnValue({
    showAllTables: jest.fn().mockResolvedValue(['gopay_order'])
  }),
  close: jest.fn().mockResolvedValue()
};

// Mock Sequelize构造函数
jest.mock('sequelize', () => {
  return {
    Sequelize: jest.fn().mockImplementation(() => mockSequelize),
    DataTypes: {
      STRING: (length) => `STRING(${length})`,
      INTEGER: 'INTEGER'
    }
  };
});

// Mock Fastify插件
const fp = require('fastify-plugin');
jest.mock('fastify-plugin', () => {
  return jest.fn().mockImplementation((fn) => fn);
});

// Mock日志
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

// Mock文件系统
const mockFs = {
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('test_cert_content')
};

jest.mock('fs', () => mockFs);

// Mock配置模块
jest.mock('../config', () => {
  return jest.fn().mockReturnValue({
    web: {
      payUrl: 'http://localhost:3000'
    },
    user: {
      '10001': {
        key: 'test_user_key'
      }
    },
    alipay: [],
    wxpay: [],
    form: {
      subject: {
        rewrite: true,
        text: ['测试商品']
      },
      body: {
        rewrite: true,
        text: ['测试描述']
      }
    },
    db: {
      use: 'sqlite',
      options: {
        sqlite: {
          storage: './database.sqlite',
          logging: false
        }
      }
    }
  });
});

describe('数据库插件测试', () => {
  let mockFastify;
  let databasePlugin;
  
  beforeEach(() => {
    // 清空所有mock函数的调用记录
    jest.clearAllMocks();
    
    // 创建模拟Fastify实例
    mockFastify = {
      decorate: jest.fn(),
      addHook: jest.fn(),
      log: mockLogger
    };
    
    // 重新加载数据库插件
    delete require.cache[require.resolve('../plugins/database.js')];
    databasePlugin = require('../plugins/database.js');
  });

  describe('SQLite数据库初始化', () => {
    test('应该正确初始化SQLite数据库', async () => {
      // 执行插件
      await databasePlugin(mockFastify, {});
      
      // 验证结果
      expect(Sequelize).toHaveBeenCalledWith(expect.objectContaining({
        storage: './database.sqlite',
        dialect: 'sqlite'
      }));
      
      expect(mockSequelize.authenticate).toHaveBeenCalled();
      expect(mockFastify.decorate).toHaveBeenCalledWith('db', mockSequelize);
    });
  });
  
  describe('MySQL数据库初始化', () => {
    test('应该正确初始化MySQL数据库', async () => {
      // 重新mock配置以使用MySQL
      jest.mock('../config', () => {
        return jest.fn().mockReturnValue({
          web: {
            payUrl: 'http://localhost:3000'
          },
          user: {
            '10001': {
              key: 'test_user_key'
            }
          },
          alipay: [],
          wxpay: [],
          form: {
            subject: {
              rewrite: true,
              text: ['测试商品']
            },
            body: {
              rewrite: true,
              text: ['测试描述']
            }
          },
          db: {
            use: 'mysql',
            options: {
              mysql: {
                host: 'localhost',
                port: 3306,
                database: 'gopay',
                username: 'gopay',
                password: 'gopay',
                logging: false
              }
            }
          }
        });
      });
      
      // 重新加载数据库插件以使用新的配置
      delete require.cache[require.resolve('../plugins/database.js')];
      const mysqlDatabasePlugin = require('../plugins/database.js');
      
      // 执行插件
      await mysqlDatabasePlugin(mockFastify, {});
      
      // 验证结果
      expect(Sequelize).toHaveBeenCalledWith(
        'gopay',
        'gopay',
        'gopay',
        expect.objectContaining({
          host: 'localhost',
          port: 3306,
          dialect: 'mysql'
        })
      );
      
      expect(mockSequelize.authenticate).toHaveBeenCalled();
      expect(mockFastify.decorate).toHaveBeenCalledWith('db', mockSequelize);
    });
  });
  
  describe('不支持的数据库类型', () => {
    test('应该在不支持的数据库类型时抛出错误', async () => {
      // 重新mock配置以使用不支持的数据库类型
      jest.mock('../config', () => {
        return jest.fn().mockReturnValue({
          web: {
            payUrl: 'http://localhost:3000'
          },
          user: {
            '10001': {
              key: 'test_user_key'
            }
          },
          alipay: [],
          wxpay: [],
          form: {
            subject: {
              rewrite: true,
              text: ['测试商品']
            },
            body: {
              rewrite: true,
              text: ['测试描述']
            }
          },
          db: {
            use: 'unsupported_db',
            options: {}
          }
        });
      });
      
      // 重新加载数据库插件以使用新的配置
      delete require.cache[require.resolve('../plugins/database.js')];
      const unsupportedDatabasePlugin = require('../plugins/database.js');
      
      // 执行插件并期望抛出错误
      await expect(unsupportedDatabasePlugin(mockFastify, {})).rejects.toThrow('Unsupported database type');
    });
  });
  
  describe('数据库连接关闭', () => {
    test('应该正确处理数据库连接关闭', async () => {
      // 执行插件
      await databasePlugin(mockFastify, {});
      
      // 验证onClose钩子被注册
      expect(mockFastify.addHook).toHaveBeenCalledWith('onClose', expect.any(Function));
      
      // 获取onClose回调函数
      const onCloseCallback = mockFastify.addHook.mock.calls[0][1];
      
      // 执行onClose回调
      const mockInstance = {
        db: mockSequelize
      };
      await onCloseCallback(mockInstance);
      
      // 验证数据库连接被关闭
      expect(mockSequelize.close).toHaveBeenCalled();
    });
  });
});