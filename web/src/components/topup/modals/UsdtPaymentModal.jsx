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
import {
  Modal,
  Typography,
  Button,
  Card,
  Banner,
  Toast,
  Space,
  Icon,
} from '@douyinfe/semi-ui';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { API, showError, showSuccess } from '../../../helpers';

const { Text, Title } = Typography;

const UsdtPaymentModal = ({ t, visible, onClose, amount, blockchainTypes }) => {
  const [step, setStep] = useState('select'); // 'select' | 'payment'
  const [selectedChain, setSelectedChain] = useState('');
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [expired, setExpired] = useState(false);
  const pollingRef = useRef(null);
  const timerRef = useRef(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setOrderData(null);
      setExpired(false);
      setLoading(false);
      // Auto-skip chain selection if only one type
      if (blockchainTypes && blockchainTypes.length === 1) {
        setSelectedChain(blockchainTypes[0]);
        setStep('payment');
        createOrder(blockchainTypes[0]);
      } else {
        setSelectedChain('');
        setStep('select');
      }
    } else {
      cleanup();
    }
  }, [visible]);

  const cleanup = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!orderData) return;
    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = orderData.expire_time - now;
      if (remaining <= 0) {
        setTimeLeft(0);
        setExpired(true);
        cleanup();
      } else {
        setTimeLeft(remaining);
      }
    };
    updateCountdown();
    timerRef.current = setInterval(updateCountdown, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [orderData, cleanup]);

  // Poll order status every 5 seconds
  useEffect(() => {
    if (!orderData || expired) return;
    const poll = async () => {
      try {
        const res = await API.get(`/api/user/usdt/status/${orderData.trade_no}`);
        const { success, data } = res.data;
        if (success && data?.status === 'success') {
          cleanup();
          showSuccess(t('充值成功！'));
          onClose(true);
        }
      } catch {
        // silent retry
      }
    };
    pollingRef.current = setInterval(poll, 5000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [orderData, expired, cleanup, onClose, t]);

  const createOrder = async (chain) => {
    setLoading(true);
    try {
      const res = await API.post('/api/user/usdt/pay', {
        amount: parseInt(amount),
        blockchain_type: chain,
      });
      const { success, data, message } = res.data;
      if (success) {
        setOrderData(data);
      } else {
        showError(data || message || t('创建订单失败'));
        onClose(false);
      }
    } catch {
      showError(t('请求失败'));
      onClose(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChain = (chain) => {
    setSelectedChain(chain);
    setStep('payment');
    createOrder(chain);
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      Toast.success(t('复制成功'));
    } catch {
      Toast.warning(t('请手动复制地址'));
    }
  };

  const handleClose = () => {
    cleanup();
    onClose(false);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const chainLabel = (type) => {
    // Tron 和 Ethereum 的 SVG 图标
    const TronIcon = () => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="#FF060A"/>
        <path d="M12 6L16 10L12 14L8 10L12 6Z" fill="white"/>
        <path d="M12 10L14 12L12 14L10 12L12 10Z" fill="#FF060A"/>
      </svg>
    );

    const EthereumIcon = () => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 24C18.6274 24 24 18.6274 24 12C24 5.37258 18.6274 0 12 0C5.37258 0 0 5.37258 0 12C0 18.6274 5.37258 24 12 24Z" fill="#627EEA"/>
        <path d="M12.373 3V9.652L17.996 12.165L12.373 3Z" fill="white" fillOpacity="0.602"/>
        <path d="M12.373 3L6.75 12.165L12.373 9.652V3Z" fill="white"/>
        <path d="M12.373 16.476V20.996L18 13.212L12.373 16.476Z" fill="white" fillOpacity="0.602"/>
        <path d="M12.373 20.996V16.475L6.75 13.212L12.373 20.996Z" fill="white"/>
        <path d="M12.373 15.429L17.996 12.165L12.373 9.654V15.429Z" fill="white" fillOpacity="0.2"/>
        <path d="M6.75 12.165L12.373 15.429V9.654L6.75 12.165Z" fill="white" fillOpacity="0.602"/>
      </svg>
    );

    const labels = { 
      tron: { name: 'Tron (TRC-20)', icon: <TronIcon /> }, 
      ethereum: { name: 'Ethereum (ERC-20)', icon: <EthereumIcon /> } 
    };
    const chainInfo = labels[type?.toLowerCase()] || { name: type, icon: <div style={{width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#ccc'}}></div> };
    return (
      <div className="flex items-center gap-2">
        {chainInfo.icon}
        <span>{chainInfo.name}</span>
      </div>
    );
  };

  const renderChainSelect = () => (
    <div className='space-y-4'>
      <Text>{t('请选择区块链网络')}</Text>
      <div className='grid grid-cols-1 gap-3'>
        {(blockchainTypes || []).map((chain) => (
          <Card
            key={chain}
            className='cursor-pointer !rounded-xl transition-all hover:shadow-md'
            bodyStyle={{ padding: '16px', textAlign: 'center' }}
            onClick={() => handleSelectChain(chain)}
          >
            <Text strong style={{ fontSize: '16px' }}>
              {chainLabel(chain)}
            </Text>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderPayment = () => {
    if (loading || !orderData) {
      return (
        <div className='py-8 flex justify-center'>
          <Text>{t('正在创建订单...')}</Text>
        </div>
      );
    }

    const isUrgent = timeLeft > 0 && timeLeft < 300;

    return (
      <div className='space-y-4'>
        {/* Countdown */}
        <div className='text-center'>
          {expired ? (
            <Banner
              type='danger'
              description={t('订单已过期，请重新发起充值')}
              closeIcon={null}
              className='!rounded-lg'
            />
          ) : (
            <div className='flex items-center justify-center gap-2'>
              <Clock size={16} />
              <Text
                style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: isUrgent ? '#f5222d' : 'var(--semi-color-text-0)',
                }}
                className={isUrgent ? 'animate-pulse' : ''}
              >
                {formatTime(timeLeft)}
              </Text>
            </div>
          )}
        </div>

        {/* Amount */}
        <div className='text-center'>
          <Text style={{ color: 'var(--semi-color-text-2)', fontSize: '14px' }}>
            {t('请转账精确金额')}
          </Text>
          <Title
            heading={2}
            style={{
              color: '#f5222d',
              margin: '4px 0',
              fontWeight: 'bold',
            }}
          >
            {orderData.usdt_amount} USDT
          </Title>
          <Text type='tertiary'>{chainLabel(orderData.blockchain_type)}</Text>
        </div>

        {/* QR Code */}
        <div className='flex justify-center'>
          <div
            style={{
              padding: '16px',
              background: '#fff',
              borderRadius: '12px',
              opacity: expired ? 0.3 : 1,
            }}
          >
            <QRCodeSVG
              value={orderData.wallet_address}
              size={200}
              level='M'
            />
          </div>
        </div>

        {/* Wallet Address */}
        <div className='text-center'>
          <Text
            style={{
              fontFamily: 'monospace',
              fontSize: '14px',
              wordBreak: 'break-all',
              lineHeight: '1.6',
            }}
          >
            {orderData.wallet_address}
          </Text>
          <div className='mt-2'>
            <Button
              icon={<Copy size={14} />}
              size='small'
              disabled={expired}
              onClick={() => handleCopy(orderData.wallet_address)}
            >
              {t('复制地址')}
            </Button>
          </div>
        </div>

        {/* Warnings */}
        <Banner
          type='warning'
          closeIcon={null}
          className='!rounded-lg'
          description={
            <div className='space-y-1'>
              <div className='flex items-start gap-1'>
                <AlertTriangle size={14} className='mt-0.5 flex-shrink-0' />
                <Text style={{ fontSize: '12px' }}>
                  {t('请务必转账精确金额，否则系统无法自动确认')}
                </Text>
              </div>
              <div className='flex items-start gap-1'>
                <AlertTriangle size={14} className='mt-0.5 flex-shrink-0' />
                <Text style={{ fontSize: '12px' }}>
                  {t('请勿向非本页面显示的地址转账')}
                </Text>
              </div>
              <div className='flex items-start gap-1'>
                <CheckCircle size={14} className='mt-0.5 flex-shrink-0' />
                <Text style={{ fontSize: '12px' }}>
                  {t('转账完成后请耐心等待系统确认')}
                </Text>
              </div>
            </div>
          }
        />
      </div>
    );
  };

  return (
    <Modal
      title={
        <div className='flex items-center gap-2'>
          {/* USDT 图标 */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="#26A17B"/>
            <path d="M12 6L16 10L12 14L8 10L12 6Z" fill="white"/>
            <path d="M12 10L14 12L12 14L10 12L12 10Z" fill="#26A17B"/>
            <text x="12" y="16" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">$</text>
          </svg>
          <Text>USDT {t('充值')}</Text>
        </div>
      }
      visible={visible}
      onCancel={handleClose}
      footer={null}
      maskClosable={false}
      centered
      width={440}
    >
      {step === 'select' ? renderChainSelect() : renderPayment()}
    </Modal>
  );
};

export default UsdtPaymentModal;