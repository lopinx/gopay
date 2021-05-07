const stringUtils = require('../utils/stringutils')
const epayUtils = require('../utils/epayutils')
module.exports = async  function (fastify, opts) {

    fastify.get('/api/order_status', async function (request, reply) {

        let out_trade_no = request.query['out_trade_no']
        // wxpay  alipay
        let type = request.query['type']
        if (stringUtils.isEmpty(out_trade_no)) {
            return fastify.resp.EMPTY_PARAMS('Params')
        }

        let sequelize = fastify.db;

        let order = await sequelize.models.Order.findOne({
            where: {
                id: out_trade_no
            }
        })

        if (order == null) {
            return fastify.resp.SYS_ERROR('订单不存在')
        }

        let data = {}

        if (order['status'] === 1) {
            // 查询 callback url
            let pid = order['pid']
            let user = fastify.user.getUser(pid)
            if (user == null) {
                return fastify.resp.SYS_ERROR('PID不存在，无法查询，请以实际到账为准')
            }

            data['callback_url'] = epayUtils.buildPayReturnCallbackUrl(order, null, user.key)

            return fastify.resp.RESP_OK('支付成功', data)
        }

        return fastify.resp.RESP_FAIL(300, '当前订单尚未支付')


    })

    fastify.get('/test', async function (request, reply){

        return '1';
    })

}