const fp = require("fastify-plugin");
const security = require("../utils/security");

module.exports = fp(async function (fastify, opts) {
  const apiKeys = new Map();

  if (opts.user) {
    Object.keys(opts.user).forEach((pid) => {
      const user = opts.user[pid];
      if (user.key) {
        const hashedKey = security.hashApiKey(user.key);
        apiKeys.set(hashedKey, { pid: pid, ...user });
      }
    });
  }

  fastify.decorate("user", {
    hasUser: function (pid) {
      if (typeof pid === "number") {
        pid = String(pid);
      }
      return opts.user[pid] !== undefined;
    },
    getUser: function (pid) {
      if (typeof pid === "number") {
        pid = String(pid);
      }
      return opts.user[pid] ? opts.user[pid] : null;
    },
  });

  fastify.decorate("apiKeys", apiKeys);
});
