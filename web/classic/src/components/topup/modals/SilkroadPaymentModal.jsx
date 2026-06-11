import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, Typography, Button, Skeleton } from '@douyinfe/semi-ui';
import { QrCode, CreditCard, ExternalLink } from 'lucide-react';
import { API, showError, showSuccess } from '../../../helpers';

const { Text, Title } = Typography;

const SilkroadPaymentModal = ({ t, visible, onClose, amount, currency }) => {
  const [step, setStep] = useState('select');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(false);
  const paymentMethods = [
    { name: 'SBP', type: 'sbp', icon: '/custom/sbp.png' },
  ];
  const pollingRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setOrderData(null);
      setSelectedMethod('');
      setStep('select');
      setLoading(false);
    } else {
      cleanup();
    }
  }, [visible]);

  const cleanup = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const createOrder = async (method) => {
    setLoading(true);
    try {
      const res = await API.post('/api/user/silkroad/pay', {
        amount: parseFloat(amount),
        payment_method: method,
      });
      if (res !== undefined) {
        const resData = res.data;
        if (resData.success) {
          setOrderData(resData);
          setStep('payment');
          if (method === 'sbp' && resData.trade_no) {
            startPolling(resData.trade_no);
          }
        } else {
          showError(resData.message || t('创建订单失败'));
          onClose(false);
        }
      } else {
        showError(res);
        onClose(false);
      }
    } catch (err) {
      showError(t('支付请求失败'));
      onClose(false);
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (tradeNo) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    pollingRef.current = setInterval(async () => {
      try {
        const res = await API.get(`/api/user/silkroad/query`, {
          params: { trade_no: tradeNo },
        });
        if (res !== undefined) {
          const queryRes = res.data;
          if (queryRes.success && queryRes.is_success) {
            cleanup();
            showSuccess(t('充值成功！'));
            onClose(true);
          }
        }
      } catch (err) {
        // polling error, ignore
      }
    }, 3000);
  };

  const handleSelectPaymentMethod = (method) => {
    setSelectedMethod(method.type);
    createOrder(method.type);
  };

  const handlePayWithMir = () => {
    if (orderData?.pay_url) {
      const payWindow = window.open(orderData.pay_url, '_blank');
      if (!payWindow) {
        // 如果弹窗被拦截，fallback 到当前窗口跳转提示
        showError(t('弹窗被浏览器拦截，请允许弹窗后重试'));
      }
    }
  };

  const handleClose = () => {
    cleanup();
    onClose(false);
  };

  const displayCurrency = currency || 'RUB';

  const renderPaymentMethodSelect = () => (
    <div className='space-y-8 py-4'>
      <div className='space-y-4'>
        <div className='text-center'>
          <Title heading={2} style={{ color: '#1a1a1a', margin: 0 }}>
            {t('在线支付订单')}
          </Title>
        </div>

        <div className='bg-gray-50 rounded-2xl p-6'>
          <div className='flex justify-between items-center mb-4'>
            <Text className='text-gray-500 text-sm'>{t('订单内容')}</Text>
            <Text strong className='text-gray-800'>{t('帐户充值')}</Text>
          </div>
          <div className='flex justify-between items-center pt-4 border-t border-gray-200'>
            <Text className='text-gray-500 text-sm'>{t('订单支付金额')}</Text>
            <Title heading={1} style={{ color: '#1890ff', margin: 0, fontSize: '32px' }}>
              {typeof amount === 'number' ? amount.toFixed(2) : Number(amount || 0).toFixed(2)} {displayCurrency}
            </Title>
          </div>
        </div>
      </div>

      <div className='space-y-4'>
        <Text strong className='block text-gray-700'>
          {t('请选择支付方式')}:
        </Text>
        <div className='flex flex-col gap-4'>
          {paymentMethods.map((method) => (
            <div
              key={method.type}
              className='cursor-pointer rounded-xl transition-all hover:shadow-lg border-2 overflow-hidden'
              style={{
                borderColor: selectedMethod === method.type ? 'var(--semi-color-primary)' : 'var(--semi-color-border)',
                background: selectedMethod === method.type ? 'rgba(24, 144, 255, 0.05)' : '#fff',
                height: '110px',
              }}
              onClick={() => handleSelectPaymentMethod(method)}
            >
              <div className='w-full h-full flex items-center justify-center'>
                <img
                  src={method.icon}
                  alt={method.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    padding: '20px',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPayment = () => {
    if (loading || !orderData) {
      return (
        <div className='py-12 flex flex-col items-center'>
          <Skeleton.Image style={{ width: 60, height: 60, borderRadius: '50%' }} />
          <Text className='mt-4'>{t('正在创建订单...')}</Text>
        </div>
      );
    }

    return (
      <div className='space-y-8 py-4'>
        <div className='text-center'>
          <Title heading={2} style={{ color: '#1a1a1a', margin: 0 }}>
            {t('在线支付订单')}
          </Title>
        </div>

        <div className='bg-gray-50 rounded-2xl p-6 space-y-4'>
          <div className='flex justify-between items-center'>
            <Text className='text-gray-500 text-sm'>{t('订单号')}</Text>
            <Text strong className='font-mono text-sm text-gray-800'>{orderData.trade_no}</Text>
          </div>
          <div className='flex justify-between items-center'>
            <Text className='text-gray-500 text-sm'>{t('订单内容')}</Text>
            <Text strong className='text-gray-800'>{t('帐户充值')}</Text>
          </div>
          <div className='flex justify-between items-center pt-4 border-t border-gray-200'>
            <Text className='text-gray-500 text-sm'>{t('订单支付金额')}</Text>
            <Title heading={1} style={{ color: '#1890ff', margin: 0, fontSize: '32px' }}>
              {typeof amount === 'number' ? amount.toFixed(2) : Number(amount || 0).toFixed(2)} {displayCurrency}
            </Title>
          </div>
        </div>

        {selectedMethod === 'sbp' && (orderData.code_url || orderData.code_img_url) && (
          <div className='space-y-6'>
            <div className='text-center'>
              <Text className='text-gray-500'>
                {t('请使用手机APP扫描以下二维码完成支付')}
              </Text>
            </div>
            <div className='flex justify-center'>
              <div className='bg-white rounded-2xl p-6 shadow-sm border border-gray-100'>
                {(() => {
                  // 优先使用 code_img_url，其次使用 code_url
                  const qrCodeData = orderData.code_img_url || orderData.code_url;
                  // 自动处理 base64 图片：如果没有 data:image 前缀则添加
                  const qrCodeSrc = qrCodeData.startsWith('data:image') 
                    ? qrCodeData 
                    : `data:image/png;base64,${qrCodeData}`;
                  
                  return (
                    <img
                      src={qrCodeSrc}
                      alt='QR Code'
                      style={{
                        width: 220,
                        height: 220,
                        borderRadius: 12,
                      }}
                    />
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {selectedMethod === 'mir' && (
          <div className='space-y-6'>
            <div className='text-center'>
              <Text className='text-gray-500'>
                {t('点击下方按钮跳转到支付平台完成支付')}
              </Text>
            </div>
            <Button
              theme='solid'
              size='large'
              onClick={handlePayWithMir}
              style={{
                width: '100%',
                height: 52,
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #1890ff, #36cafc)',
                border: 'none',
                color: '#fff',
              }}
              icon={<ExternalLink size={20} />}
            >
              {t('立即支付')}
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal
      title={
        <div className='flex items-center gap-2'>
          <CreditCard size={20} className='text-primary' />
          <Text strong>{t('Gwiff Pay')}</Text>
        </div>
      }
      visible={visible}
      onCancel={handleClose}
      footer={null}
      maskClosable={false}
      centered
      width={480}
    >
      {step === 'select' ? renderPaymentMethodSelect() : renderPayment()}
    </Modal>
  );
};

export default SilkroadPaymentModal;