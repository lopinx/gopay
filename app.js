'use strict'

const path = require('path')
const Fastify = require('fastify')
const AutoLoad = require('fastify-autoload')
const PointView = require('point-of-view')
const Fstatic = require('fastify-static')
const Fsformbody = require('fastify-formbody')
const axios = require('fastify-axios')
const ejs = require('ejs')
const configure = require('./configure')

const fastify = Fastify({
    logger: {
        level: 'info',
        // file: 'stream' // Will use pino.destination()
    },
    pluginTimeout: 10000
})

fastify.register(axios, {
    timeout: 25 * 1000,
    headers: {'X-GOPAY': '1'},
    retry: 3,
    retryDelay: 1000,
    validateStatus: function (status) {
        return status >= 200 && status < 500; // default
    },
    interceptors: {
        response: function (response) {
            return response
        },
        errorResponse: function (err) {
            let config = err.config;
            // If config does not exist or the retry option is not set, reject
            if (!config || !config.retry) return Promise.reject(err);
            // Set the variable for keeping track of the retry count
            config.__retryCount = config.__retryCount || 0;
            // Check if we've maxed out the total number of retries
            if (config.__retryCount >= config.retry) {
                // Reject with the error
                return Promise.reject(err);
            }
            // Increase the retry count
            config.__retryCount += 1;
            // Create new promise to handle exponential backoff
            let backoff = new Promise(function (resolve) {
                setTimeout(function () {
                    resolve();
                }, config.retryDelay || 1);
            });
            // Return the promise in which recalls axios to retry the request
            return backoff.then(function () {
                return fastify.axios(config);
            });
        }
    }
})

fastify.register(Fsformbody)

fastify.register(Fstatic, {
    root: path.join(__dirname, 'public'),
    prefix: '/public/',
})


fastify.register(PointView, {
    engine: {
        ejs: ejs,
    }
})

fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: configure
})

fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: configure
})

fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes/pay/alipay'),
    options: configure
})
fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes/pay/wechat'),
    options: configure
})

fastify.listen(process.env.PORT || 3000, '127.0.0.1', (err) => {
    if (err) {
        console.log(err)
        fastify.log.error(err)
        process.exit(1)
    }
})

