const fp = require('fastify-plugin');

module.exports = fp(async function (fastify, opts) {
  fastify.decorate('user', {
    hasUser: function (pid) {
      if (pid instanceof Number) {
        pid += '';
      }
      return opts.user[pid] !== undefined;
    },
    getUser: function (pid) {
      if (pid instanceof Number) {
        pid += '';
      }
      return opts.user[pid] ? opts.user[pid] : null;
    },
  });
});
