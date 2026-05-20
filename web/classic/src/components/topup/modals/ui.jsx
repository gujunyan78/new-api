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

import React from 'react';
import { Modal, Typography, Button, Card, Space } from '@douyinfe/semi-ui';

const { Text, Title } = Typography;

export const PaymentModalHeader = ({ title, icon: Icon, iconColor = 'var(--semi-color-primary)' }) => (
  <div className='flex items-center gap-2'>
    {Icon && <Icon size={20} style={{ color: iconColor }} />}
    <Text strong>{title}</Text>
  </div>
);

export const OrderInfoCard = ({ t, tradeNo, description, amount, currency = '₽' }) => (
  <div className='bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 space-y-3'>
    {tradeNo && (
      <div className='flex justify-between items-center'>
        <Text className='text-gray-600'>{t('订单号')}</Text>
        <Text strong className='font-mono text-sm'>{tradeNo}</Text>
      </div>
    )}
    <div className='flex justify-between items-center'>
      <Text className='text-gray-600'>{t('订单描述')}</Text>
      <Text strong>{description}</Text>
    </div>
    <div className='flex justify-between items-center pt-2 border-t border-gray-200'>
      <Text className='text-gray-600'>{t('订单金额')}</Text>
      <Title heading={2} style={{ color: '#f5222d', margin: 0 }}>
        {currency}{typeof amount === 'number' ? amount.toFixed(2) : Number(amount || 0).toFixed(2)}
      </Title>
    </div>
  </div>
);

export const PaymentMethodCard = ({ 
  name, 
  icon, 
  iconType,
  onClick, 
  selected,
  disabled 
}) => (
  <Card
    className={`cursor-pointer !rounded-xl transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:border-primary hover:scale-105'}`}
    bodyStyle={{ padding: '20px', textAlign: 'center' }}
    onClick={disabled ? undefined : onClick}
    style={{
      borderWidth: '2px',
      borderColor: selected ? 'var(--semi-color-primary)' : 'var(--semi-color-border)',
    }}
  >
    {icon ? (
      <img
        src={icon}
        alt={name}
        style={{
          width: '60px',
          height: '60px',
          objectFit: 'contain',
          marginBottom: '12px',
        }}
      />
    ) : iconType === 'sbp' ? (
      <div className='w-16 h-16 mx-auto mb-3 bg-blue-100 rounded-xl flex items-center justify-center'>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="#3B82F6" strokeWidth="2"/>
          <path d="M7 12L10 15L17 8" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    ) : (
      <div className='w-16 h-16 mx-auto mb-3 bg-orange-100 rounded-xl flex items-center justify-center'>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="4" width="20" height="16" rx="2" stroke="#F97316" strokeWidth="2"/>
          <line x1="2" y1="10" x2="22" y2="10" stroke="#F97316" strokeWidth="2"/>
          <rect x="6" y="14" width="12" height="2" rx="1" fill="#F97316"/>
        </svg>
      </div>
    )}
    <Text strong style={{ fontSize: '16px' }}>
      {name}
    </Text>
  </Card>
);

export const PrimaryPaymentButton = ({ t, onClick, loading, children, icon: Icon }) => (
  <Button
    theme='solid'
    size='large'
    onClick={onClick}
    loading={loading}
    style={{
      width: '100%',
      height: 48,
      fontSize: 16,
      fontWeight: 600,
      borderRadius: 8,
      background: 'linear-gradient(135deg, #FF6B35, #FF8F65)',
      border: 'none',
      color: '#fff',
    }}
    icon={Icon && <Icon size={18} />}
  >
    {loading ? t('处理中...') : children}
  </Button>
);

export const QRCodeDisplay = ({ src, alt = 'QR Code', t }) => (
  <div className='space-y-4'>
    <div className='text-center'>
      <Text className='text-gray-500 text-sm'>
        {t('请使用手机APP扫以下二维码完成支付')}
      </Text>
    </div>
    <div className='flex justify-center'>
      <img
        src={src}
        alt={alt}
        style={{
          width: 200,
          height: 200,
          borderRadius: 8,
          border: '1px solid var(--semi-color-border)',
        }}
      />
    </div>
  </div>
);

export const LoadingState = ({ t }) => (
  <div className='py-12 flex flex-col items-center'>
    <div className='w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4'></div>
    <Text>{t('正在创建订单...')}</Text>
  </div>
);

export const PaymentModal = ({ 
  title, 
  visible, 
  onCancel, 
  footer = null, 
  maskClosable = false, 
  centered = true, 
  width = 420,
  icon: Icon,
  iconColor,
  children 
}) => (
  <Modal
    title={PaymentModalHeader({ title, icon: Icon, iconColor })}
    visible={visible}
    onCancel={onCancel}
    footer={footer}
    maskClosable={maskClosable}
    centered={centered}
    width={width}
  >
    {children}
  </Modal>
);