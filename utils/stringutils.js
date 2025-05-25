const crypto = require('crypto');

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

exports.cutString = function cutString(str, len) {
  if (str.length * 2 <= len) {
    return str;
  }
  let strlen = 0;
  let s = '';
  for (let i = 0; i < str.length; i++) {
    s = s + str.charAt(i);
    if (str.charCodeAt(i) > 128) {
      strlen = strlen + 2;
      if (strlen >= len) {
        return s.substring(0, s.length - 1) + '...';
      }
    } else {
      strlen = strlen + 1;
      if (strlen >= len) {
        return s.substring(0, s.length - 2) + '...';
      }
    }
  }
  return s;
};

exports.filterParams = function (params) {
  let descArray = {};
  for (let key in params) {
    if (key === 'sign' || key === 'sign_type' || params[key] === '') {
    } else {
      descArray[key] = params[key];
    }
  }
  return descArray;
};

exports.sortParams = function (params) {
  let keys = Object.keys(params).sort(),
    sortedParams = {};

  for (let i in keys) {
    sortedParams[keys[i]] = params[keys[i]];
  }
  return sortedParams;
};

/**
 *
 * @param params   sorted params
 * @param sign
 * @param epkey 易支付的商户key XM9b0ce7BE6R9NQ897B0wW0LW031B181
 */
exports.checkSign = function (params, sign, epkey) {
  let arg = '';
  for (let key in params) {
    arg += key + '=' + params[key] + '&';
  }
  arg = arg.substring(0, arg.length - 1);
  return md5(arg + epkey.trim()) === sign;
};

/**
 * 计算易支付的对接签名
 * @param params
 * @param epkey
 */
exports.epaySign = function (params, epkey) {
  let arg = '';
  for (let key in params) {
    arg += key + '=' + params[key] + '&';
  }
  arg = arg.substring(0, arg.length - 1);
  return md5(arg + epkey.trim());
};

exports.getUrlencodeQuery = function (params) {
  let arg = '';
  for (let key in params) {
    arg += key + '=' + encodeURIComponent(params[key]) + '&';
  }
  arg = arg.substring(0, arg.length - 1);
  return arg;
};

exports.isEmpty = function (obj) {
  return obj === undefined || obj == null || obj === '';
};

let ua = [
  'android',
  'midp',
  'nokia',
  'mobile',
  'iphone',
  'ipod',
  'blackberry',
  'windows phone',
];

exports.checkMobile = function (useragent) {
  useragent = useragent.toLowerCase();
  let isMobile = false;
  for (let i = 0; i < ua.length; i++) {
    if (useragent.indexOf(ua[i]) !== -1) {
      // 手机端
      isMobile = true;
      break;
    }
  }
  return isMobile;
};
