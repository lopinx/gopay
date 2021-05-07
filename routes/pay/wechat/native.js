module.exports = async function (fastify, opts) {

    /**
     * native 扫码支付
     */
    fastify.get('/pay/wxpay/native', async function (request, reply) {

            let cr = request.query['cr']
            let out_trade_no = request.query['out_trade_no'] // 订单 uuid
            let useragent = request.query['ua']

            let ejsData = {
                out_trade_no: out_trade_no,
                url: cr
            };
            if (useragent !== 'mobile') {
                // 查询订单信息
                let order = await fastify.db.models.Order.findOne({
                    where: {
                        id: out_trade_no
                    }
                })
                if (order === null) {
                    return fastify.resp.SYS_ERROR('当前订单不存在')
                }
                ejsData['order'] = order

            }

            return reply.view('/templates/wechat/' + (useragent === 'mobile' ? 'm_' : 'pc_') + 'native_pay.ejs', ejsData)
        }
    )
}