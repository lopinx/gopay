"use strict";
const fp = require("fastify-plugin");
const { Sequelize, DataTypes } = require("sequelize");
const path = require("path");

module.exports = fp(async function (fastify, opts) {
  let sequelize;
  // 默认使用 SQLite
  let dialect = (opts.db && opts.db.dialect) || "sqlite";

  if (dialect === "sqlite") {
    // SQLite 配置
    let dbPath =
      (opts.db && opts.db.sqlite && opts.db.sqlite.storage) ||
      path.join(__dirname, "..", "data", "gopay.db");
    let logging =
      opts.db && opts.db.sqlite && opts.db.sqlite.logging !== undefined
        ? opts.db.sqlite.logging
        : false;

    sequelize = new Sequelize({
      dialect: "sqlite",
      storage: dbPath,
      logging: logging,
    });
    fastify.log.info("使用 SQLite 数据库: " + dbPath);
  } else if (dialect === "mysql") {
    // MySQL 配置
    let mysql = opts.db.mysql;
    sequelize = new Sequelize(mysql.database, mysql.username, mysql.password, {
      host: mysql.host,
      dialect: "mysql",
      pool: mysql.pool,
      logging: mysql.logging,
      dialectOptions: {
        dateStrings: true,
        typeCast: true,
      },
      timezone: "+08:00",
    });
    fastify.log.info("使用 MySQL 数据库: " + mysql.host + "/" + mysql.database);
  } else if (dialect === "postgres") {
    // PostgreSQL 配置
    let postgres = opts.db.postgres;
    sequelize = new Sequelize(
      postgres.database,
      postgres.username,
      postgres.password,
      {
        host: postgres.host,
        port: postgres.port || 5432,
        dialect: "postgres",
        pool: postgres.pool,
        logging: postgres.logging,
        timezone: "+08:00",
      },
    );
    fastify.log.info(
      "使用 PostgreSQL 数据库: " +
        postgres.host +
        ":" +
        (postgres.port || 5432) +
        "/" +
        postgres.database,
    );
  } else {
    throw new Error("不支持的数据库类型: " + dialect);
  }

  // 映射数据库模型
  const Order = sequelize.define(
    "Order",
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
      tableName: "gopay_order",
      createdAt: true,
      updatedAt: true,
    },
  );

  await sequelize.sync();

  fastify.decorate("db", sequelize);
});
