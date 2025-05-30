const aes = require('wechatpay-axios-plugin/lib/aes');

describe('微信支付回调通知解密测试', () => {
  // 测试数据
  const notify = {
    id: 'bbd51dad-5b3e-56da-b848-3b0c48b8b69a',
    create_time: '2021-03-30T23:23:37+08:00',
    resource_type: 'encrypt-resource',
    event_type: 'TRANSACTION.SUCCESS',
    summary: '支付成功',
    resource: {
      original_type: 'transaction',
      algorithm: 'AEAD_AES_256_GCM',
      ciphertext:
        'psh0qACOkInOI6yHD/sq8DWaih7bRdz28MxxsFPzFURJ7eaH+52R9BKIurSG0o40FoGCTsfUj6AeEAPYGSFpudYjAzy+b8uaTcVPSQvTs4KLKpTXdJw8Wwg1u7g4PujPDWdOxrH3izXFHzjTkVulbVA6NXOyC0bxeWEDjBYe4hmROQFnr8+yYN6vtU56w8NtqXRFoJd5KvN6oySttVQD/bldJ+LO5Bh+HQ5kAY/rcwef6XuwBt6NYRlWYNZa0Y0d9JxaMDDonBYgqyfC7iTOfNhItS9m2F/oXaZLHyRQwRKa/dnIm5TJDE5OBAqt/yzDaFmTqzGmPILobuBDEvButJL8XXnQFfKciX5n1HBaAbxojEnHfeHzgUY5zYK5zeHqhqEqHK8y+zpNsUr6/SilkmqvhrMH99jTKZdkr+/ea5mztvk94zpAwg9Jy41qBCphvOIit4Pw6tK+I9Ga3Oo5pA8nNNkQbVoXpBaGtI29XnLmf2sQi/KxYwBcUGcRm3nW4aLffx5KsoYCkO3Puc2PwdqyDy1n3F8f9cbRgVNj4I6t4+JizozXv7lj7R0bVnzqLRJjpfEz7tGu2F+h/Y8CxInSL5EyP/ITosNMxwxO3oFc6yVTxUi6JQs=',
      associated_data: 'transaction',
      nonce: 'evs6pMSQzUr0',
    },
  };

  const secret = '00000000001111111111000000000011';

  test('解密微信支付回调数据', () => {
    // 执行解密操作
    const cert = aes.decrypt(
      notify.resource.nonce,
      secret,
      notify.resource.ciphertext,
      notify.resource.associated_data
    );

    // 解析解密结果
    const decryptedData = JSON.parse(cert);

    // 添加断言
    expect(decryptedData).toBeDefined();
    expect(typeof decryptedData).toBe('object');

    // 验证交易成功相关字段
    if (notify.event_type === 'TRANSACTION.SUCCESS') {
      expect(decryptedData.out_trade_no).toBeDefined();
      expect(decryptedData.transaction_id).toBeDefined();
      expect(decryptedData.trade_state).toBe('SUCCESS');
    }

    // 打印解密结果（可选）
    console.log('解密结果:', decryptedData);
  });
});
