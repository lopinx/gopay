'use strict';

const path = require('path');
const Fastify = require('fastify');
const AutoLoad = require('fastify-autoload');
const PointView = require('point-of-view');
const Fstatic = require('fastify-static');
const Fsformbody = require('fastify-formbody');
const axios = require('fastify-axios');
const ejs = require('ejs');
const configure = require('./config')();

const fastify = Fastify({
  logger: {
    level: 'info',
    // file: 'stream' // Will use pino.destination()
  },
  pluginTimeout: 10000,
});

fastify.register(axios, {
  timeout: 25 * 1000,
  headers: { 'X-GOPAY': '1' },
  retry: 3,
  retryDelay: 1000,
  validateStatus: function (status) {
    return status >= 200 && status < 500; // default
  },
  interceptors: {
    response: function (response) {
      return response;
    },
    errorResponse: function (err) {
      let config = err.config;
      if (!config || !config.retry) return Promise.reject(err);
      config.__retryCount = config.__retryCount || 0;
      if (config.__retryCount >= config.retry) {
        return Promise.reject(err);
      }
      config.__retryCount += 1;
      let backoff = new Promise(function (resolve) {
        setTimeout(function () {
          resolve();
        }, config.retryDelay || 1);
      });
      return backoff.then(function () {
        return fastify.axios(config);
      });
    },
  },
});

fastify.register(Fsformbody);

fastify.register(Fstatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/public/',
});

fastify.register(PointView, {
  engine: {
    ejs: ejs,
  },
});

fastify.register(AutoLoad, {
  dir: path.join(__dirname, 'plugins'),
  options: configure,
});

fastify.register(AutoLoad, {
  dir: path.join(__dirname, 'routes'),
  options: configure,
});

// 改回3000端口
fastify.listen(process.env.PORT || 3000, '127.0.0.1', (err) => {
  if (err) {
    console.log(err);
    fastify.log.error(err);
    process.exit(1);
  }
});