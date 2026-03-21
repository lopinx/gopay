"use strict";

const path = require("path");
const Fastify = require("fastify");
const AutoLoad = require("@fastify/autoload");
const PointView = require("@fastify/view");
const Fstatic = require("@fastify/static");
const Fsformbody = require("@fastify/formbody");
const axios = require("axios");
const ejs = require("ejs");
const rateLimit = require("@fastify/rate-limit");
const config = require("./config");

const fastify = Fastify({
  logger: {
    level: "info",
  },
  pluginTimeout: 10000,
});

const axiosInstance = axios.create({
  timeout: 25 * 1000,
  headers: { "X-GOPAY": "1" },
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (err) => {
    const config = err.config;
    if (!config || !config.retry) return Promise.reject(err);
    config.__retryCount = config.__retryCount || 0;
    if (config.__retryCount >= config.retry) {
      return Promise.reject(err);
    }
    config.__retryCount += 1;
    await new Promise((resolve) => setTimeout(resolve, config.retryDelay || 1));
    return axiosInstance(config);
  }
);

fastify.decorate("axios", axiosInstance);

fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (request) => request.ip,
  errorResponseBuilder: () => ({ code: 429, msg: '请求过于频繁，请稍后再试' })
});

fastify.register(Fsformbody);

fastify.register(Fstatic, {
  root: path.join(__dirname, "public"),
  prefix: "/public/",
});

fastify.register(PointView, {
  engine: {
    ejs: ejs,
  },
});

fastify.register(AutoLoad, {
  dir: path.join(__dirname, "plugins"),
  options: config,
});

fastify.register(AutoLoad, {
  dir: path.join(__dirname, "routes"),
  options: config,
});

fastify.register(AutoLoad, {
  dir: path.join(__dirname, "routes/pay/alipay"),
  options: config,
});

fastify.register(AutoLoad, {
  dir: path.join(__dirname, "routes/pay/wechat"),
  options: config,
});

fastify.setErrorHandler((error, request, reply) => {
  const isDev = process.env.NODE_ENV === 'development';
  
  fastify.log.error({
    error: error.message,
    stack: isDev ? error.stack : undefined,
    url: request.url,
    method: request.method,
    requestId: request.id,
  });

  if (reply.statusCode >= 500) {
    reply.send({
      code: 500,
      msg: "服务器内部错误",
      requestId: request.id,
    });
  } else {
    reply.send({
      code: reply.statusCode,
      msg: error.message || "请求错误",
      requestId: request.id,
    });
  }
});

const shutdown = async (signal) => {
  fastify.log.info(`收到 ${signal} 信号，开始优雅关闭...`);
  try {
    await fastify.close();
    if (fastify.db) {
      await fastify.db.close();
    }
    fastify.log.info('服务已安全关闭');
    process.exit(0);
  } catch (e) {
    fastify.log.error('关闭服务时出错:', e);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

fastify.listen({ port: process.env.PORT || 3000, host: process.env.HOST || "127.0.0.1" }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
