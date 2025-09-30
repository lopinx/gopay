const fp = require('fastify-plugin');

module.exports = fp(async function (fastify, opts) {
  fastify.decorate('user', {
    hasUser: function (pid) {
      // 增强类型检查
      if (pid === undefined || pid === null) {
        return false;
      }
      
      if (typeof pid === 'number') {
        pid = pid.toString();
      }
      
      if (typeof pid !== 'string') {
        return false;
      }
      
      return opts.user && opts.user[pid] !== undefined;
    },
    getUser: function (pid) {
      // 增强类型检查
      if (pid === undefined || pid === null) {
        return null;
      }
      
      if (typeof pid === 'number') {
        pid = pid.toString();
      }
      
      if (typeof pid !== 'string') {
        return null;
      }
      
      return opts.user && opts.user[pid] ? opts.user[pid] : null;
    },
  });
});