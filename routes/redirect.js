const stringUtils = require('../utils/stringutils')


module.exports = async function (fastify, opts) {
    fastify.get('/go', async function (request, reply) {

        let redirectUrl = request.query['url']
        let type = request.query['type']
        if (type === 'base64') {
            redirectUrl = Buffer.from(redirectUrl,'base64').toString();
        }

        if (stringUtils.isEmpty(redirectUrl)) {
            return fastify.resp.EMPTY_PARAMS('redirectUrl')
        }
        return reply.view('/templates/jump.ejs', {
            return_url: redirectUrl
        })
    })
}