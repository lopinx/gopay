'use strict'
const stringUtils = require('../utils/stringutils')
const {v4: uuidv4} = require('uuid');

module.exports = async function (fastify, opts) {

    /**
     * 兼容易支付接口
     */
    fastify.post('/submit.php', async function (request, reply) {

        let fromWhere = null
        if (Object.keys(request.body).length > 0) {
            fromWhere = request.body
        } else if (Object.keys(request.query).length > 0) {
            fromWhere = request.query
        }
        if (fromWhere == null) {
            return fastify.resp.EMPTY_PARAMS('form')
        }

        let sign = fromWhere['sign'];
        let money = fromWhere['money']
        let name = fromWhere['name']
        let notify_url = fromWhere['notify_url']
        let return_url = fromWhere['return_url']
        let out_trade_no = fromWhere['out_trade_no']
        let pid = fromWhere['pid']
        let type = fromWhere['type']


        let ua = request.headers['user-agent']
        let client_ip = request.ip

        if (request.headers['x-real-ip']) {
            client_ip = request.headers['x-real-ip']
        }

        // GOPay用户
        let user = null;
        if (stringUtils.isEmpty(ua)) {
            return fastify.resp.EMPTY_PARAMS('UA')
        }
        if (stringUtils.isEmpty(type)) {
            return fastify.resp.EMPTY_PARAMS('type')
        }
        if (stringUtils.isEmpty(pid)) {
            return fastify.resp.EMPTY_PARAMS('pid')
        }
        if (stringUtils.isEmpty(name)) {
            return fastify.resp.EMPTY_PARAMS('name')
        }
        if (stringUtils.isEmpty(notify_url)) {
            return fastify.resp.EMPTY_PARAMS('notify_url')
        }
        if (stringUtils.isEmpty(return_url)) {
            return fastify.resp.EMPTY_PARAMS('return_url')
        }
        if (stringUtils.isEmpty(money) || !/^[0-9.]+$/.test(money)) {
            return fastify.resp.EMPTY_PARAMS('money')
        }
        if (stringUtils.isEmpty(out_trade_no) || !/^[a-zA-Z0-9._-|]+$/.test(out_trade_no)) {
            return fastify.resp.EMPTY_PARAMS('out_trade_no')
        }
        if (stringUtils.isEmpty(sign)) {
            return fastify.resp.EMPTY_PARAMS('sign')
        }
        if (!(user = fastify.user.getUser(pid))) {
            return fastify.resp.PID_ERROR
        }

        let params = stringUtils.sortParams(stringUtils.filterParams(fromWhere))
        // 校验签名是否是易支付发过来的
        if (!stringUtils.checkSign(params, sign, user['key'])) {
            return fastify.resp.SIGN_ERROR
        }

        let err = false;
        let payurl = '';

        let type_sgin = 'none'
        let isMobile = stringUtils.checkMobile(ua)

        if (type === 'alipay') {
            // 支付宝支付
            let alipay = fastify.alipay.newInstance()
            if (alipay == null) {
                return fastify.resp.ALIPAY_NO
            }
            let form = {
                outTradeNo: out_trade_no, // 订单号
                totalAmount: money,
                subject: name,
                body: '',
                extendParams: {
                    appid: alipay.appId
                }
            }
            // 重写表单参数
            if (opts.form.subject && opts.form.subject.rewrite) {
                let subjectText = opts.form.subject.text;
                if (subjectText) {
                    if (subjectText instanceof Array) {
                        // 随机一个标题
                        if (subjectText.length > 0) {
                            form.subject = subjectText[Math.floor(Math.random() * subjectText.length)]
                        }
                    } else {
                        form.subject = subjectText
                    }
                }
            }
            if (opts.form.body && opts.form.body.rewrite) {
                let bodyText = opts.form.body.text;
                if (bodyText) {
                    if (bodyText instanceof Array) {
                        // 随机一个body
                        if (bodyText.length > 0) {
                            form.body = bodyText[Math.floor(Math.random() * bodyText.length)]
                        }
                    } else {
                        form.body = bodyText
                    }
                }
            }

            let notifyUrl = opts.web.payUrl + '/pay/alipay_notify'
            let returnUrl = opts.web.payUrl + '/pay/alipay_return'

            try {
                payurl = await alipay.exec(form.outTradeNo, form.totalAmount, form.subject,
                    form.body, isMobile ? 'wap' : 'page', notifyUrl, returnUrl)

                // 创建数据库订单信息
                let sequelize = fastify.db;
                let uuid = uuidv4().replace(/-/g, '').toUpperCase();
                const payOrder = await sequelize.models.Order.create({
                    id: uuid,
                    out_trade_no: form.outTradeNo,
                    notify_url: notify_url,
                    return_url: return_url,
                    type: type,
                    pid: pid,
                    title: name,
                    money: form.totalAmount,
                    status: 0
                });
                fastify.log.info('创建 ' + type + ' 订单成功：' + JSON.stringify(payOrder))

            } catch (e) {
                err = true;
                //console.log(e)
            }


        } else if (type === 'wxpay') {
            //微信支付
            // native扫码、h5支付
            let wxpay = fastify.wxpay.newInstance()

            let notifyUrl = opts.web.payUrl + '/pay/wxpay_notify/' + wxpay.getAppid()
            let uuid = uuidv4().replace(/-/g, '').toUpperCase();

            let wxOrderName = name;
            if (opts.form.subject && opts.form.subject.rewrite) {
                let subjectText = opts.form.subject.text;
                if (subjectText) {
                    if (subjectText instanceof Array) {
                        // 随机一个标题
                        if (subjectText.length > 0) {
                            wxOrderName = subjectText[Math.floor(Math.random() * subjectText.length)]
                        }
                    } else {
                        wxOrderName = subjectText
                    }
                }
            }


            let formData = wxpay.formData(isMobile ? 'h5' : 'native', {
                total: parseInt(money) * 100,
                description: wxOrderName,
                notify_url: notifyUrl,
                out_trade_no: uuid, // 使用自己的订单号
                payer_client_ip: client_ip // 仅 h5 有效
            })


            try {
                let wxresp = await wxpay.exec(formData)
                console.log('isMobile ' + isMobile + '   isOnlyNavtive ' + wxpay.isOnlyNavtive())
                if (!isMobile || wxpay.isOnlyNavtive()) {
                    // 扫码支付
                    payurl = opts.web.payUrl + '/pay/wxpay/native?cr=' + wxresp.data.code_url + '&out_trade_no=' + uuid + '&ua=' + (isMobile ? 'mobile' : 'pc')
                    payurl = Buffer.from(payurl).toString('base64')
                    type_sgin = 'base64';
                } else {
                    // 进入h5支付
                    payurl = wxresp.data.h5_url
                }

                // 订单写入数据库
                let order = await fastify.db.models.Order.create({
                    id: uuid,
                    out_trade_no: out_trade_no, // 源 网站生成的订单号
                    notify_url: notify_url,
                    return_url: return_url,
                    type: type,
                    pid: pid,
                    title: name,
                    money: money,
                    status: 0
                })

                fastify.log.info('创建 ' + type + ' 订单成功：' + uuid)

            } catch (e) {
                let errmsg = e.response['data']['message']
                return fastify.resp.SYS_ERROR(errmsg ? errmsg : '创建微信订单错误')
            }


        } else {
            return {code: 404, msg: '其他支付方式开发中'};
        }

        if (err) {
            return fastify.resp.SYS_ERROR('创建订单失败，请返回重试。');
        }


        return reply.view('/templates/submit.ejs', {
            payurl: payurl,
            time: new Date().getTime(),
            type: type_sgin
        })
    })

}

