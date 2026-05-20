/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, Typography, Card, Button, Skeleton } from '@douyinfe/semi-ui';
import { QrCode, CreditCard, ExternalLink } from 'lucide-react';
import { API, showError, showSuccess } from '../../../helpers';

const { Text, Title } = Typography;

const WepayPaymentModal = ({ t, visible, onClose, amount }) => {
  const [step, setStep] = useState('select'); // 'select' | 'payment'
  const [selectedMethod, setSelectedMethod] = useState(''); // 'sbp' | 'mir'
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const pollingRef = useRef(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setOrderData(null);
      setSelectedMethod('');
      setStep('select');
      setLoading(false);
      fetchPaymentMethods();
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

  const fetchPaymentMethods = async () => {
    try {
      const res = await API.get('/api/user/topup/info');
      if (res.data?.success) {
        const payMethods = res.data.data?.pay_methods || [];
        const wepayMethod = payMethods.find(
          (method) => method.type === 'wepay'
        );
        // Build SBP and MIR sub-methods from the unified wepay entry
        const methods = [];
        if (wepayMethod) {
          methods.push(
            { name: 'SBP', type: 'sbp', icon: wepayMethod.sbp_logo },
            { name: 'MIR', type: 'mir', icon: wepayMethod.mir_logo }
          );
        }
        setPaymentMethods(methods);
      }
    } catch (error) {
      console.error('Failed to fetch payment methods:', error);
    }
  };

  const createOrder = async (method) => {
    setLoading(true);
    try {
      const res = await API.post('/api/user/wepay/pay', {
        amount: parseInt(amount),
        payment_method: method,
      });
      if (res !== undefined) {
        const { success, message, data } = res.data;
        if (success) {
          setOrderData(data);
          setStep('payment');
          if (method === 'sbp' && data.trade_no) {
            startPolling(data.trade_no, 'sbp');
          }
        } else {
          showError(message || t('创建订单失败'));
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

  const startPolling = (tradeNo, method) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    pollingRef.current = setInterval(async () => {
      try {
        const res = await API.get(`/api/user/wepay/query`, {
          params: { trade_no: tradeNo, payment_method: method },
        });
        if (res !== undefined) {
          const { success, data } = res.data;
          if (success && data?.is_success) {
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
      window.open(orderData.pay_url, '_blank');
    }
  };

  const handleClose = () => {
    cleanup();
    onClose(false);
  };

  const renderPaymentMethodSelect = () => (
    <div className='space-y-8 py-4'>
      {/* Order Info */}
      <div className='space-y-4'>
        <div className='text-center'>
          <Title heading={2} style={{ color: '#1a1a1a', margin: 0 }}>
            {t('确认充值')}
          </Title>
        </div>
        
        <div className='bg-gray-50 rounded-2xl p-6'>
          <div className='flex justify-between items-center mb-4'>
            <Text className='text-gray-500 text-sm'>{t('订单描述')}</Text>
            <Text strong className='text-gray-800'>{t('账户充值')}</Text>
          </div>
          <div className='flex justify-between items-center pt-4 border-t border-gray-200'>
            <Text className='text-gray-500 text-sm'>{t('订单金额')}</Text>
            <Title heading={1} style={{ color: '#1890ff', margin: 0, fontSize: '32px' }}>
              ₽{typeof amount === 'number' ? amount.toFixed(2) : Number(amount || 0).toFixed(2)}
            </Title>
          </div>
        </div>
      </div>

      {/* Payment Method Selection */}
      <div className='space-y-4'>
        <Text strong className='block text-gray-700'>
          {t('选择支付方式')}
        </Text>
        <div className='grid grid-cols-2 gap-4'>
          {paymentMethods.map((method) => (
            <Card
              key={method.type}
              className='cursor-pointer !rounded-xl transition-all hover:shadow-lg hover:border-primary border-2 overflow-hidden'
              bodyStyle={{ padding: 0, height: '110px' }}
              onClick={() => handleSelectPaymentMethod(method)}
              style={{
                borderColor: selectedMethod === method.type ? 'var(--semi-color-primary)' : 'var(--semi-color-border)',
                background: selectedMethod === method.type ? 'rgba(24, 144, 255, 0.05)' : '#fff',
              }}
            >
              {method.icon ? (
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
              ) : method.type === 'sbp' ? (
                <div className='w-full h-full flex items-center justify-center bg-blue-50'>
                  <QrCode size={52} className='text-blue-600' />
                </div>
              ) : (
                <div className='w-full h-full flex items-center justify-center bg-orange-50'>
                  <CreditCard size={52} className='text-orange-600' />
                </div>
              )}
            </Card>
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
        {/* Header */}
        <div className='text-center'>
          <Title heading={2} style={{ color: '#1a1a1a', margin: 0 }}>
            {t('完成支付')}
          </Title>
        </div>

        {/* Order Info */}
        <div className='bg-gray-50 rounded-2xl p-6 space-y-4'>
          <div className='flex justify-between items-center'>
            <Text className='text-gray-500 text-sm'>{t('订单号')}</Text>
            <Text strong className='font-mono text-sm text-gray-800'>{orderData.trade_no}</Text>
          </div>
          <div className='flex justify-between items-center'>
            <Text className='text-gray-500 text-sm'>{t('订单描述')}</Text>
            <Text strong className='text-gray-800'>{t('账户充值')}</Text>
          </div>
          <div className='flex justify-between items-center pt-4 border-t border-gray-200'>
            <Text className='text-gray-500 text-sm'>{t('订单金额')}</Text>
            <Title heading={1} style={{ color: '#1890ff', margin: 0, fontSize: '32px' }}>
              ₽{typeof amount === 'number' ? amount.toFixed(2) : Number(amount || 0).toFixed(2)}
            </Title>
          </div>
        </div>

        {/* SBP QR Code Payment */}
        {selectedMethod === 'sbp' && (orderData.code_url || orderData.code_img_url) && (
          <div className='space-y-6'>
            <div className='text-center'>
              <Text className='text-gray-500'>
                {t('请使用手机APP扫以下二维码完成支付')}
              </Text>
            </div>
            <div className='flex justify-center'>
              <div className='bg-white rounded-2xl p-6 shadow-sm border border-gray-100'>
                <img
                  src={orderData.code_img_url || orderData.code_url}
                  alt='QR Code'
                  style={{
                    width: 220,
                    height: 220,
                    borderRadius: 12,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* MIR Payment Button */}
        {selectedMethod === 'mir' && (
          <div className='space-y-6'>
            <div className='text-center'>
              <Text className='text-gray-500'>
                {t('点击下方按钮跳转到 MIR 支付页面')}
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
          <Text strong>{t('支付')}</Text>
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

export default WepayPaymentModal;
