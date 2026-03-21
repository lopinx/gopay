"use strict";

module.exports = async function (fastify, opts) {
  fastify.get('/health', async function (request, reply) {
    try {
      await fastify.db.authenticate();
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: 'connected'
      };
    } catch (e) {
      reply.code(503);
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: e.message
      };
    }
  });

  fastify.get('/ready', async function (request, reply) {
    const alipayReady = fastify.alipay.newInstance() !== null;
    const wxpayReady = fastify.wxpay.newInstance() !== null;
    const dbReady = await fastify.db.authenticate().then(() => true).catch(() => false);

    if (!alipayReady && !wxpayReady) {
      reply.code(503);
      return {
        status: 'not ready',
        reason: 'no payment channels configured',
        alipay: alipayReady,
        wxpay: wxpayReady,
        database: dbReady
      };
    }

    return {
      status: 'ready',
      alipay: alipayReady,
      wxpay: wxpayReady,
      database: dbReady
    };
  });
};