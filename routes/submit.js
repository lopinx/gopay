'use strict';
const stringUtils = require('../utils/stringutils');
const { v4: uuidv4 } = require('uuid');

module.exports = async function (fastify, opts) {
  /**
   * 兼容易支付接口
   */
  fastify.post('/submit.php', async function (request, reply) {
    try {
      let fromWhere = null;
      if (Object.keys(request.body).length > 0) {
        fromWhere = request.body;
      } else if (Object.keys(request.query).length > 0) {
        fromWhere = request.query;
      }
      
      if (fromWhere == null) {
        fastify.log.warn('submit.php: 缺少表单参数');
        return fastify.resp.EMPTY_PARAMS('form');
      }

      let sign = fromWhere['sign'];
      let money = fromWhere['money'];
      let name = fromWhere['name'];
      let notify_url = fromWhere['notify_url'];
      let return_url = fromWhere['return_url'];
      let out_trade_no = fromWhere['out_trade_no'];
      let pid = fromWhere['pid'];
      let type = fromWhere['type'];

      let ua = request.headers['user-agent'];
      let client_ip = request.ip;

      if (request.headers['x-real-ip']) {
        client_ip = request.headers['x-real-ip'];
      }

      // GOPay用户
      let user = null;
      
      // 参数验证
      if (stringUtils.isEmpty(ua)) {
        fastify.log.warn('submit.php: 缺少User-Agent参数');
        return fastify.resp.EMPTY_PARAMS('UA');
      }
      
      if (stringUtils.isEmpty(type)) {
        fastify.log.warn('submit.php: 缺少type参数');
        return fastify.resp.EMPTY_PARAMS('type');
      }
      
      if (stringUtils.isEmpty(pid)) {
        fastify.log.warn('submit.php: 缺少pid参数');
        return fastify.resp.EMPTY_PARAMS('pid');
      }
      
      if (stringUtils.isEmpty(name)) {
        fastify.log.warn('submit.php: 缺少name参数');
        return fastify.resp.EMPTY_PARAMS('name');
      }
      
      if (stringUtils.isEmpty(notify_url)) {
        fastify.log.warn('submit.php: 缺少notify_url参数');
        return fastify.resp.EMPTY_PARAMS('notify_url');
      }
      
      if (stringUtils.isEmpty(return_url)) {
        fastify.log.warn('submit.php: 缺少return_url参数');
        return fastify.resp.EMPTY_PARAMS('return_url');
      }
      
      if (stringUtils.isEmpty(money) || !/^[0-9.]+$/.test(money)) {
        fastify.log.warn('submit.php: money参数无效');
        return fastify.resp.EMPTY_PARAMS('money');
      }
      
      if (
        stringUtils.isEmpty(out_trade_no) ||
        !/^[a-zA-Z0-9._-|]+$/.test(out_trade_no)
      ) {
        fastify.log.warn('submit.php: out_trade_no参数无效');
        return fastify.resp.EMPTY_PARAMS('out_trade_no');
      }
      
      if (stringUtils.isEmpty(sign)) {
        fastify.log.warn('submit.php: 缺少sign参数');
        return fastify.resp.EMPTY_PARAMS('sign');
      }
      
      if (!(user = fastify.user.getUser(pid))) {
        fastify.log.warn('submit.php: 无效的PID: ' + pid);
        return fastify.resp.PID_ERROR;
      }

      let params = stringUtils.sortParams(stringUtils.filterParams(fromWhere));
      // 校验签名是否是易支付发过来的
      if (!stringUtils.checkSign(params, sign, user['key'])) {
        fastify.log.warn('submit.php: 签名验证失败, pid: ' + pid + ', out_trade_no: ' + out_trade_no);
        return fastify.resp.SIGN_ERROR;
      }

      let err = false;
      let payurl = '';

      let type_sgin = 'none';
      let isMobile = stringUtils.checkMobile(ua);

      if (type === 'alipay') {
        // 支付宝支付
        let alipay = fastify.alipay.newInstance();
        if (alipay == null) {
          fastify.log.error('submit.php: 未配置支付宝支付');
          return fastify.resp.ALIPAY_NO;
        }
        
        let form = {
          outTradeNo: out_trade_no, // 订单号
          totalAmount: money,
          subject: name,
          body: '',
          extendParams: {
            appid: alipay.appId,
          },
        };
        
        // 重写表单参数
        if (opts.form.subject && opts.form.subject.rewrite) {
          let subjectText = opts.form.subject.text;
          if (subjectText) {
            if (subjectText instanceof Array) {
              // 随机一个标题
              if (subjectText.length > 0) {
                form.subject =
                  subjectText[Math.floor(Math.random() * subjectText.length)];
              }
            } else {
              form.subject = subjectText;
            }
          }
        }
        
        if (opts.form.body && opts.form.body.rewrite) {
          let bodyText = opts.form.body.text;
          if (bodyText) {
            if (bodyText instanceof Array) {
              // 随机一个body
              if (bodyText.length > 0) {
                form.body = bodyText[Math.floor(Math.random() * bodyText.length)];
              }
            } else {
              form.body = bodyText;
            }
          }
        }

        let notifyUrl = opts.web.payUrl + '/pay/alipay_notify';
        let returnUrl = opts.web.payUrl + '/pay/alipay_return';

        try {
          payurl = await alipay.exec(
            form.outTradeNo,
            form.totalAmount,
            form.subject,
            form.body,
            isMobile ? 'wap' : 'page',
            notifyUrl,
            returnUrl
          );

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
            status: 0,
          });
          fastify.log.info(
            '创建 ' + type + ' 订单成功：' + JSON.stringify(payOrder)
          );
        } catch (alipayError) {
          err = true;
          fastify.log.error('submit.php: 创建支付宝订单失败: ' + alipayError.message);
          fastify.log.error(alipayError);
        }
      } else if (type === 'wxpay') {
        //微信支付
        // native扫码、h5支付
        let wxpay = fastify.wxpay.newInstance();
        if (wxpay == null) {
          fastify.log.error('submit.php: 未配置微信支付');
          return fastify.resp.SYS_ERROR('未配置微信支付');
        }

        let notifyUrl = opts.web.payUrl + '/pay/wxpay_notify/' + wxpay.getAppid();
        let uuid = uuidv4().replace(/-/g, '').toUpperCase();

        let wxOrderName = name;
        if (opts.form.subject && opts.form.subject.rewrite) {
          let subjectText = opts.form.subject.text;
          if (subjectText) {
            if (subjectText instanceof Array) {
              // 随机一个标题
              if (subjectText.length > 0) {
                wxOrderName =
                  subjectText[Math.floor(Math.random() * subjectText.length)];
              }
            } else {
              wxOrderName = subjectText;
            }
          }
        }

        let formData = wxpay.formData(isMobile ? 'h5' : 'native', {
          total: parseInt(money) * 100,
          description: wxOrderName,
          notify_url: notifyUrl,
          out_trade_no: uuid, // 使用自己的订单号
          payer_client_ip: client_ip, // 仅 h5 有效
        });

        try {
          let wxresp = await wxpay.exec(formData);
          fastify.log.info(
            'isMobile ' + isMobile + '   isOnlyNavtive ' + wxpay.isOnlyNavtive()
          );
          
          if (!isMobile || wxpay.isOnlyNavtive()) {
            // 扫码支付
            payurl =
              opts.web.payUrl +
              '/pay/wxpay/native?cr=' +
              wxresp.code_url +
              '&out_trade_no=' +
              uuid +
              '&ua=' +
              (isMobile ? 'mobile' : 'pc');
            payurl = Buffer.from(payurl).toString('base64');
            type_sgin = 'base64';
          } else {
            // 进入h5支付
            payurl = wxresp.h5_url;
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
            status: 0,
          });

          fastify.log.info('创建 ' + type + ' 订单成功：' + uuid);
        } catch (wxpayError) {
          err = true;
          let errmsg = wxpayError.message || '创建微信订单错误';
          if (wxpayError.response && wxpayError.response.data) {
            errmsg = wxpayError.response.data.message || errmsg;
          }
          fastify.log.error('submit.php: 创建微信订单失败: ' + errmsg);
          fastify.log.error(wxpayError);
          return fastify.resp.SYS_ERROR(errmsg);
        }
      } else {
        fastify.log.warn('submit.php: 不支持的支付类型: ' + type);
        return { code: 404, msg: '其他支付方式开发中' };
      }

      if (err) {
        fastify.log.error('submit.php: 创建订单失败，请返回重试。');
        return fastify.resp.SYS_ERROR('创建订单失败，请返回重试。');
      }

      return reply.view('/templates/submit.ejs', {
        payurl: payurl,
        time: new Date().getTime(),
        type: type_sgin,
      });
    } catch (error) {
      fastify.log.error('submit.php: 处理支付请求时发生未处理的错误: ' + error.message);
      fastify.log.error(error);
      return fastify.resp.SYS_ERROR('系统错误，请稍后重试。');
    }
  });
};