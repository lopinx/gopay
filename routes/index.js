'use strict';

module.exports = async function (fastify, opts) {
  fastify.get('/', async function (request, reply) {
    reply.type('text/html').code(200);
    return reply.view('/templates/index.ejs');
  });
};
