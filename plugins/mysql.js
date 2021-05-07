'use strict'
const fp = require('fastify-plugin')
const {Sequelize, DataTypes} = require('sequelize');

module.exports = fp(async function (fastify
    , opts) {

    const sequelize = new Sequelize(opts.db.mysql.database, opts.db.mysql.username, opts.db.mysql.password, {
        host: opts.db.mysql.host,
        dialect: 'mysql' /* one of 'mysql' | 'mariadb' | 'postgres' | 'mssql' */,
        pool: opts.db.mysql.pool,
        logging: opts.db.mysql.logging,

        dialectOptions: {
            dateStrings: true,
            typeCast: true
        },
        timezone: '+08:00',
    });

    // 映射数据库模型
    const Order = sequelize.define('Order', {
        // ... (attributes)
        id: {type: DataTypes.STRING(40), primaryKey: true},
        out_trade_no: DataTypes.STRING,
        notify_url: DataTypes.STRING,
        return_url: DataTypes.STRING,
        type: DataTypes.STRING(10), // alipay   weixin

        pid: DataTypes.INTEGER,
        title: DataTypes.STRING,
        money: DataTypes.STRING,
        status: DataTypes.INTEGER,
        attach:DataTypes.STRING

    }, {
        tableName: 'gopay_order',
        createdAt: true,
        updatedAt: true
    });



    // await sequelize.sync({ after: true });
    await sequelize.sync();

    fastify.decorate('db', sequelize);
})