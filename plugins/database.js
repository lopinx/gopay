'use strict';
const fp = require('fastify-plugin');
const { Sequelize, DataTypes } = require('sequelize');
const config = require('../configure')();

// 公共配置
const COMMON_CONFIG = {
  timezone: '+08:00',
  ssl: {
    require: false,
    rejectUnauthorized: false,
  },
};

module.exports = fp(async function (fastify, opts) {
  // 从配置中获取所选的数据库类型和配置，默认使用sqlite
  const dbSelector = config.db.use || 'sqlite';
  const dbOptions = config.db.options[dbSelector] || {
    storage: './gopay.sqlite',
    logging: false,
  };

  // 基础配置
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

  // 特殊处理：SQLite不需要用户名和密码
  const sequelize =
    dbSelector === 'sqlite'
      ? new Sequelize(sequelizeConfig)
      : new Sequelize(
          dbOptions.database,
          dbOptions.username,
          dbOptions.password,
          sequelizeConfig
        );

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

  // 测试连接并检查表
  try {
    await sequelize.authenticate();
    const queryInterface = sequelize.getQueryInterface();

    if (dbSelector !== 'sqlite') {
      const [databases] = await sequelize.query('SHOW DATABASES LIKE ?', {
        replacements: [dbOptions.database],
      });

      if (databases.length === 0) {
        throw new Error(`Database ${dbOptions.database} does not exist`);
      }
    }

    const tables = await queryInterface.showAllTables();
    const tableExists = tables.includes('gopay_order');

    if (!tableExists) {
      await Order.sync();
    }
  } catch (error) {
    throw error;
  }

  fastify.decorate('db', sequelize);

  fastify.addHook('onClose', async (instance) => {
    await instance.db.close();
    fastify.log.info(`Database connection (${dbSelector}) closed`);
  });
});

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
