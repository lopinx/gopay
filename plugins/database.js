'use strict';
const fp = require('fastify-plugin');
const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config')();

// 支持的数据库类型
const SUPPORTED_DATABASES = ['sqlite', 'mysql', 'postgres', 'mssql', 'mariadb'];

// 公共配置
const COMMON_CONFIG = {
  timezone: '+08:00',
  ssl: {
    require: false,
    rejectUnauthorized: false,
  },
};

module.exports = fp(async function (fastify, opts) {
  try {
    // 从配置中获取所选的数据库类型和配置
    const dbSelector = getDatabaseType(config);
    const dbOptions = getDatabaseOptions(config, dbSelector);
    
    // 验证数据库类型是否支持
    if (!SUPPORTED_DATABASES.includes(dbSelector)) {
      throw new Error(`Unsupported database type: ${dbSelector}. Supported types: ${SUPPORTED_DATABASES.join(', ')}`);
    }
    
    fastify.log.info(`Initializing ${dbSelector} database connection...`);

    // 基础配置
    const sequelizeConfig = buildSequelizeConfig(dbSelector, dbOptions);

    // 特殊处理：SQLite不需要用户名和密码
    const sequelize = createSequelizeInstance(dbSelector, dbOptions, sequelizeConfig);

    // 映射数据库模型
    const Order = sequelize.define(
      'Order',
      {
        id: { type: DataTypes.STRING(40), primaryKey: true },
        out_trade_no: DataTypes.STRING,
        notify_url: DataTypes.STRING,
        return_url: DataTypes.STRING,
        type: DataTypes.STRING(10),
        pid: DataTypes.INTEGER,
        title: DataTypes.STRING,
        money: DataTypes.STRING,
        status: DataTypes.INTEGER,
        attach: DataTypes.STRING,
      },
      {
        tableName: 'gopay_order',
        createdAt: true,
        updatedAt: true,
      }
    );

    // 测试连接并初始化数据库
    await initializeDatabase(sequelize, dbSelector, dbOptions, Order, fastify);

    fastify.decorate('db', sequelize);

    fastify.addHook('onClose', async (instance) => {
      try {
        await instance.db.close();
        fastify.log.info(`Database connection (${dbSelector}) closed`);
      } catch (error) {
        fastify.log.error(`Error closing database connection (${dbSelector}):`, error.message);
      }
    });
    
    fastify.log.info(`${dbSelector} database initialized successfully`);
  } catch (error) {
    fastify.log.error('Database initialization failed:', error.message);
    throw error;
  }
});

// 获取数据库类型
function getDatabaseType(config) {
  // 优先使用配置中的数据库类型
  if (config.db && config.db.use) {
    const dbType = config.db.use.toLowerCase();
    // 验证数据库类型是否支持
    if (!SUPPORTED_DATABASES.includes(dbType)) {
      throw new Error(`Unsupported database type: ${dbType}. Supported types: ${SUPPORTED_DATABASES.join(', ')}`);
    }
    return dbType;
  }
  
  // 默认使用sqlite
  return 'sqlite';
}

// 获取数据库选项
function getDatabaseOptions(config, dbSelector) {
  if (config.db && config.db.options && config.db.options[dbSelector]) {
    return config.db.options[dbSelector];
  }
  
  // 返回默认配置
  if (dbSelector === 'sqlite') {
    return {
      storage: './database.sqlite',
      logging: false,
    };
  }
  
  // 其他数据库类型的默认配置
  return {
    host: 'localhost',
    port: getDefaultPort(dbSelector),
    logging: false,
  };
}

// 构建Sequelize配置
function buildSequelizeConfig(dbSelector, dbOptions) {
  const sequelizeConfig = {
    host: dbOptions.host,
    port: dbOptions.port || getDefaultPort(dbSelector),
    dialect: dbSelector,
    charset: dbOptions.charset,
    collate: dbOptions.collate,
    pool: dbOptions.pool,
    logging: dbOptions.logging,
  };

  // 根据不同数据库类型调整配置
  switch (dbSelector) {
    case 'sqlite':
      sequelizeConfig.storage = dbOptions.storage || './database.sqlite';
      break;

    case 'postgres':
      sequelizeConfig.dialectOptions = {
        ssl: {
          ...COMMON_CONFIG.ssl,
          ...dbOptions.sslOptions,
        },
        ...dbOptions.dialectOptions,
      };
      break;

    case 'mssql':
      sequelizeConfig.dialectOptions = {
        options: {
          encrypt: dbOptions.encrypt || false,
          trustServerCertificate:
            dbOptions.trustServerCertificate !== undefined
              ? dbOptions.trustServerCertificate
              : false,
          ...dbOptions.sslOptions,
        },
        ...dbOptions.dialectOptions,
      };
      break;

    case 'mysql':
    case 'mariadb':
      sequelizeConfig.dialectOptions = {
        dateStrings: true,
        typeCast: true,
        connectTimeout: dbOptions.connectTimeout || 10000,
        ...dbOptions.dialectOptions,
      };
      break;
  }

  // 为除SQLite外的所有数据库添加时区和SSL配置
  if (dbSelector !== 'sqlite') {
    // 添加时区配置
    sequelizeConfig.timezone = COMMON_CONFIG.timezone;

    // 添加SSL配置（SQLite不需要）
    if (dbOptions.ssl) {
      if (!sequelizeConfig.dialectOptions) {
        sequelizeConfig.dialectOptions = {};
      }

      if (dbSelector === 'mssql') {
        sequelizeConfig.dialectOptions.options = {
          ...sequelizeConfig.dialectOptions.options,
          encrypt: true,
          ...COMMON_CONFIG.ssl,
          ...dbOptions.sslOptions,
        };
      } else {
        sequelizeConfig.dialectOptions.ssl = {
          ...COMMON_CONFIG.ssl,
          require: true,
          ...dbOptions.sslOptions,
        };
      }
    }
  }
  
  return sequelizeConfig;
}

// 创建Sequelize实例
function createSequelizeInstance(dbSelector, dbOptions, sequelizeConfig) {
  if (dbSelector === 'sqlite') {
    return new Sequelize(sequelizeConfig);
  } else {
    // 验证必要参数
    if (!dbOptions.database) {
      throw new Error(`Missing database name for ${dbSelector}`);
    }
    
    if (!dbOptions.username) {
      throw new Error(`Missing username for ${dbSelector}`);
    }
    
    return new Sequelize(
      dbOptions.database,
      dbOptions.username,
      dbOptions.password,
      sequelizeConfig
    );
  }
}

// 初始化数据库
async function initializeDatabase(sequelize, dbSelector, dbOptions, Order, fastify) {
  try {
    // 测试数据库连接
    await sequelize.authenticate();
    fastify.log.info(`Database connection established for ${dbSelector}`);
    
    // 对于非SQLite数据库，检查数据库是否存在
    if (dbSelector !== 'sqlite') {
      await checkAndCreateDatabase(sequelize, dbSelector, dbOptions, fastify);
    }

    // 检查并创建表
    await checkAndCreateTable(sequelize, Order, fastify);
  } catch (error) {
    fastify.log.error('Database initialization error:', error.message);
    throw error;
  }
}

// 检查并创建数据库（适用于支持的数据库类型）
async function checkAndCreateDatabase(sequelize, dbSelector, dbOptions, fastify) {
  try {
    switch (dbSelector) {
      case 'mysql':
      case 'mariadb':
        // MySQL/MariaDB检查并创建数据库
        try {
          // 首先尝试连接到information_schema数据库来检查目标数据库是否存在
          const checkDbSequelize = new Sequelize(
            'information_schema',
            dbOptions.username,
            dbOptions.password,
            {
              host: dbOptions.host,
              port: dbOptions.port || 3306,
              dialect: dbSelector,
              logging: false,
            }
          );
          
          const [databases] = await checkDbSequelize.query(
            'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
            {
              replacements: [dbOptions.database],
            }
          );
          
          await checkDbSequelize.close();
          
          if (databases.length === 0) {
            fastify.log.info(`Database ${dbOptions.database} does not exist, attempting to create it...`);
            // 尝试创建数据库
            const createDbSequelize = new Sequelize(
              '',
              dbOptions.username,
              dbOptions.password,
              {
                host: dbOptions.host,
                port: dbOptions.port || 3306,
                dialect: dbSelector,
                logging: false,
              }
            );
            
            await createDbSequelize.query(`CREATE DATABASE IF NOT EXISTS \`${dbOptions.database}\``, {
              raw: true,
            });
            
            await createDbSequelize.close();
            fastify.log.info(`Database ${dbOptions.database} created successfully`);
          } else {
            fastify.log.info(`Database ${dbOptions.database} already exists`);
          }
        } catch (err) {
          fastify.log.warn(`Could not check/create database ${dbOptions.database}:`, err.message);
        }
        break;
        
      case 'postgres':
        // PostgreSQL检查并创建数据库
        try {
          // 连接到postgres数据库来检查目标数据库是否存在
          const checkDbSequelize = new Sequelize(
            'postgres',
            dbOptions.username,
            dbOptions.password,
            {
              host: dbOptions.host,
              port: dbOptions.port || 5432,
              dialect: 'postgres',
              logging: false,
            }
          );
          
          const [databases] = await checkDbSequelize.query(
            'SELECT datname FROM pg_database WHERE datname = $1',
            {
              bind: [dbOptions.database],
            }
          );
          
          await checkDbSequelize.close();
          
          if (databases.length === 0) {
            fastify.log.info(`Database ${dbOptions.database} does not exist, attempting to create it...`);
            // 尝试创建数据库
            const createDbSequelize = new Sequelize(
              'postgres',
              dbOptions.username,
              dbOptions.password,
              {
                host: dbOptions.host,
                port: dbOptions.port || 5432,
                dialect: 'postgres',
                logging: false,
              }
            );
            
            await createDbSequelize.query(`CREATE DATABASE "${dbOptions.database}"`, {
              raw: true,
            });
            
            await createDbSequelize.close();
            fastify.log.info(`Database ${dbOptions.database} created successfully`);
          } else {
            fastify.log.info(`Database ${dbOptions.database} already exists`);
          }
        } catch (err) {
          fastify.log.warn(`Could not check/create database ${dbOptions.database}:`, err.message);
        }
        break;
        
      default:
        // 其他数据库类型暂不自动创建
        fastify.log.info(`Database creation not supported for ${dbSelector}, skipping...`);
        break;
    }
  } catch (error) {
    // 忽略检查错误，继续初始化
    fastify.log.warn(`Could not check if database exists: ${error.message}`);
  }
}

// 检查并创建表
async function checkAndCreateTable(sequelize, Order, fastify) {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    const tableExists = tables.includes('gopay_order');

    if (!tableExists) {
      fastify.log.info('Creating gopay_order table...');
      await Order.sync();
      fastify.log.info('gopay_order table created successfully');
    } else {
      fastify.log.info('gopay_order table already exists');
    }
  } catch (error) {
    fastify.log.error('Error checking/creating table:', error.message);
    throw error;
  }
}

// 根据数据库类型返回默认端口
function getDefaultPort(dialect) {
  const ports = {
    mysql: 3306,
    postgres: 5432,
    mssql: 1433,
    mariadb: 3306,
    // SQLite不需要端口
  };
  return ports[dialect] || undefined;
}