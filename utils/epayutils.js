const stringUtils = require('./stringutils')

/**
 *
 * @param order   数据库 Order 模型
 * @param trade_no  支付宝的订单号
 * @param ukey      易支付商户 key
 * @returns {string}    通知源站的 url
 */
exports.buildPayNotifyCallbackUrl = function (order, trade_no, ukey) {
    let order_notify_url = order.notify_url
    let eParams = {
        pid: order.pid,
        trade_no: trade_no,
        out_trade_no: order.out_trade_no,
        type: order.type,
        name: order.title,
        money: order.money,
        trade_status: 'TRADE_SUCCESS'
    }
    let sortedParams = stringUtils.sortParams(stringUtils.filterParams(eParams))
    let epaySign = stringUtils.epaySign(sortedParams, ukey)
    let queryStr = stringUtils.getUrlencodeQuery(sortedParams)
    if (order_notify_url.indexOf('?') === -1) {
        order_notify_url = order_notify_url + '?' + queryStr + '&sign=' + epaySign + '&sign_type=MD5'
    } else {
        order_notify_url = order_notify_url + queryStr + '&sign=' + epaySign + '&sign_type=MD5'
    }
    return order_notify_url
}

exports.buildPayReturnCallbackUrl = function (order, trade_no, ukey) {
    let order_return_url = order.return_url
    let eParams = {
        pid: order.pid,
        out_trade_no: order.out_trade_no,
        type: order.type,
        name: order.title,
        money: order.money,
        trade_status: 'TRADE_SUCCESS'
    }
    if (!stringUtils.isEmpty(trade_no)) {
        eParams['trade_no'] = trade_no
    }
    let sortedParams = stringUtils.sortParams(stringUtils.filterParams(eParams))
    let epaySign = stringUtils.epaySign(sortedParams, ukey)
    let queryStr = stringUtils.getUrlencodeQuery(sortedParams)
    if (order_return_url.indexOf('?') === -1) {
        order_return_url = order_return_url + '?' + queryStr + '&sign=' + epaySign + '&sign_type=MD5'
    } else {
        order_return_url = order_return_url + queryStr + '&sign=' + epaySign + '&sign_type=MD5'
    }
    return order_return_url;
}