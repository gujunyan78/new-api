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

import React, { useEffect, useState, useRef } from 'react';
import {
  Banner,
  Button,
  Form,
  Row,
  Col,
  Typography,
  Spin,
  Table,
  Modal,
  Input,
  Space,
  Select,
  InputNumber,
  Switch,
} from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

function validateWalletAddress(address, blockchainType) {
  if (blockchainType === 'tron') {
    if (!address.startsWith('T') || address.length !== 34) {
      return 'Tron 地址必须以 T 开头且长度为 34 个字符';
    }
  } else if (blockchainType === 'ethereum') {
    if (!address.startsWith('0x') || address.length !== 42) {
      return 'Ethereum 地址必须以 0x 开头且长度为 42 个字符';
    }
  } else {
    return '请选择区块链类型';
  }
  return '';
}

export default function SettingsPaymentGatewayUsdt(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    UsdtEnabled: false,
    UsdtMinTopUp: 1,
    TronGridApiKey: '',
    EtherscanApiKey: '',
  });
  const formApiRef = useRef(null);

  // Wallet list state
  const [wallets, setWallets] = useState([]);
  // Wallet modal state
  const [walletModalVisible, setWalletModalVisible] = useState(false);
  const [editingWalletIndex, setEditingWalletIndex] = useState(-1);
  const [walletForm, setWalletForm] = useState({
    address: '',
    blockchain_type: 'tron',
    priority: 100,
    enabled: true,
  });

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        UsdtEnabled:
          props.options.UsdtEnabled === 'true' ||
          props.options.UsdtEnabled === true,
        UsdtMinTopUp: parseInt(props.options.UsdtMinTopUp) || 1,
        TronGridApiKey: props.options.TronGridApiKey || '',
        EtherscanApiKey: props.options.EtherscanApiKey || '',
      };
      setInputs(currentInputs);
      formApiRef.current.setValues(currentInputs);

      // Parse wallet list
      try {
        const raw = props.options.UsdtWallets;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setWallets(parsed);
          }
        }
      } catch {
        setWallets([]);
      }
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(values);
  };

  const submitUsdtSetting = async () => {
    setLoading(true);
    try {
      const options = [];

      options.push({
        key: 'UsdtEnabled',
        value: inputs.UsdtEnabled ? 'true' : 'false',
      });
      options.push({
        key: 'UsdtMinTopUp',
        value: String(inputs.UsdtMinTopUp || 1),
      });

      if (inputs.TronGridApiKey && inputs.TronGridApiKey !== '') {
        options.push({ key: 'TronGridApiKey', value: inputs.TronGridApiKey });
      }
      if (inputs.EtherscanApiKey && inputs.EtherscanApiKey !== '') {
        options.push({
          key: 'EtherscanApiKey',
          value: inputs.EtherscanApiKey,
        });
      }

      // Save wallet list
      options.push({
        key: 'UsdtWallets',
        value: JSON.stringify(wallets),
      });

      const requestQueue = options.map((opt) =>
        API.put('/api/option/', {
          key: opt.key,
          value: opt.value,
        }),
      );

      const results = await Promise.all(requestQueue);
      const errorResults = results.filter((res) => !res.data.success);
      if (errorResults.length > 0) {
        errorResults.forEach((res) => {
          showError(res.data.message);
        });
      } else {
        showSuccess(t('更新成功'));
        props.refresh?.();
      }
    } catch (error) {
      showError(t('更新失败'));
    }
    setLoading(false);
  };

  // Wallet modal handlers
  const openAddWalletModal = () => {
    setEditingWalletIndex(-1);
    setWalletForm({
      address: '',
      blockchain_type: 'tron',
      priority: 100,
      enabled: true,
    });
    setWalletModalVisible(true);
  };

  const openEditWalletModal = (record, index) => {
    setEditingWalletIndex(index);
    setWalletForm({
      address: record.address || '',
      blockchain_type: record.blockchain_type || 'tron',
      priority: record.priority ?? 100,
      enabled: record.enabled !== false,
    });
    setWalletModalVisible(true);
  };

  const handleWalletModalOk = () => {
    if (!walletForm.address || walletForm.address.trim() === '') {
      showError(t('钱包地址不能为空'));
      return;
    }
    const validationError = validateWalletAddress(
      walletForm.address.trim(),
      walletForm.blockchain_type,
    );
    if (validationError) {
      showError(t(validationError));
      return;
    }
    const newWallet = {
      address: walletForm.address.trim(),
      blockchain_type: walletForm.blockchain_type,
      priority: walletForm.priority ?? 100,
      enabled: walletForm.enabled,
    };
    if (editingWalletIndex === -1) {
      setWallets([...wallets, newWallet]);
    } else {
      const updated = [...wallets];
      updated[editingWalletIndex] = newWallet;
      setWallets(updated);
    }
    setWalletModalVisible(false);
  };

  const handleDeleteWallet = (index) => {
    setWallets(wallets.filter((_, i) => i !== index));
  };

  const walletColumns = [
    {
      title: t('钱包地址'),
      dataIndex: 'address',
      render: (text) => (
        <Text copyable style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {text}
        </Text>
      ),
    },
    {
      title: t('区块链类型'),
      dataIndex: 'blockchain_type',
      render: (text) =>
        text === 'tron' ? 'Tron (TRC-20)' : 'Ethereum (ERC-20)',
    },
    {
      title: t('优先级'),
      dataIndex: 'priority',
    },
    {
      title: t('启用'),
      dataIndex: 'enabled',
      render: (val) => (val ? t('是') : t('否')),
    },
    {
      title: t('操作'),
      key: 'action',
      render: (_, record, index) => (
        <Space>
          <Button
            size='small'
            onClick={() => openEditWalletModal(record, index)}
          >
            {t('编辑')}
          </Button>
          <Button
            size='small'
            type='danger'
            onClick={() => handleDeleteWallet(index)}
          >
            {t('删除')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <Form
        initValues={inputs}
        onValueChange={handleFormChange}
        getFormApi={(api) => (formApiRef.current = api)}
      >
        <Form.Section text={t('USDT 设置')}>
          <Banner
            type='info'
            description={t(
              '配置 USDT 加密货币支付，支持 Tron (TRC-20) 和 Ethereum (ERC-20) 网络。需要配置对应区块链的 API Key 以自动验证交易。',
            )}
          />

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.Switch
                field='UsdtEnabled'
                label={t('启用 USDT 支付')}
                size='default'
                checkedText='｜'
                uncheckedText='〇'
              />
            </Col>
            <Col xs={24} sm={24} md={8} lg={8} xl={8}>
              <Form.InputNumber
                field='UsdtMinTopUp'
                label={t('最低充值金额')}
                placeholder='1'
                min={1}
                step={1}
                extraText={t('USDT 充值的最低金额，默认 1')}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='TronGridApiKey'
                label={t('TronGrid API Key')}
                placeholder={t('用于查询 Tron 链上 USDT 交易')}
                type='password'
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='EtherscanApiKey'
                label={t('Etherscan API Key')}
                placeholder={t('用于查询 Ethereum 链上 USDT 交易')}
                type='password'
              />
            </Col>
          </Row>

          <Button onClick={submitUsdtSetting} style={{ marginTop: 16 }}>
            {t('更新 USDT 设置')}
          </Button>
        </Form.Section>
      </Form>

      {/* Wallet address management */}
      <div style={{ marginTop: 24 }}>
        <Typography.Title heading={6} style={{ marginBottom: 8 }}>
          {t('收款钱包地址')}
        </Typography.Title>
        <Text type='secondary'>
          {t(
            '管理 USDT 收款钱包地址，系统将按优先级选择启用的钱包地址接收用户转账。',
          )}
        </Text>
        <div style={{ marginTop: 12, marginBottom: 12 }}>
          <Button onClick={openAddWalletModal}>
            {t('添加钱包地址')}
          </Button>
        </div>
        <Table
          columns={walletColumns}
          dataSource={wallets}
          rowKey={(_, index) => index}
          pagination={false}
          size='small'
          empty={
            <Text type='tertiary'>
              {t('暂无钱包地址，点击上方按钮添加')}
            </Text>
          }
        />
        <Button onClick={submitUsdtSetting} style={{ marginTop: 16 }}>
          {t('更新 USDT 设置')}
        </Button>
      </div>

      {/* Add/Edit wallet modal */}
      <Modal
        title={
          editingWalletIndex === -1
            ? t('添加钱包地址')
            : t('编辑钱包地址')
        }
        visible={walletModalVisible}
        onOk={handleWalletModalOk}
        onCancel={() => setWalletModalVisible(false)}
        okText={t('确定')}
        cancelText={t('取消')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ marginBottom: 4 }}>
              <Text strong>{t('区块链类型')}</Text>
              <span
                style={{
                  color: 'var(--semi-color-danger)',
                  marginLeft: 4,
                }}
              >
                *
              </span>
            </div>
            <Select
              value={walletForm.blockchain_type}
              onChange={(val) =>
                setWalletForm({ ...walletForm, blockchain_type: val })
              }
              style={{ width: '100%' }}
            >
              <Select.Option value='tron'>Tron (TRC-20)</Select.Option>
              <Select.Option value='ethereum'>
                Ethereum (ERC-20)
              </Select.Option>
            </Select>
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>
              <Text strong>{t('钱包地址')}</Text>
              <span
                style={{
                  color: 'var(--semi-color-danger)',
                  marginLeft: 4,
                }}
              >
                *
              </span>
            </div>
            <Input
              value={walletForm.address}
              onChange={(val) =>
                setWalletForm({ ...walletForm, address: val })
              }
              placeholder={
                walletForm.blockchain_type === 'tron'
                  ? 'T...'
                  : '0x...'
              }
              style={{ fontFamily: 'monospace' }}
            />
            <Text type='tertiary' size='small'>
              {walletForm.blockchain_type === 'tron'
                ? t('Tron 地址以 T 开头，长度 34 个字符')
                : t('Ethereum 地址以 0x 开头，长度 42 个字符')}
            </Text>
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>
              <Text strong>{t('优先级')}</Text>
            </div>
            <InputNumber
              value={walletForm.priority}
              onChange={(val) =>
                setWalletForm({ ...walletForm, priority: val })
              }
              min={0}
              step={1}
              style={{ width: '100%' }}
            />
            <Text type='tertiary' size='small'>
              {t('数值越大优先级越高，系统优先使用高优先级钱包')}
            </Text>
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>
              <Text strong>{t('启用')}</Text>
            </div>
            <Switch
              checked={walletForm.enabled}
              onChange={(val) =>
                setWalletForm({ ...walletForm, enabled: val })
              }
              checkedText='｜'
              uncheckedText='〇'
            />
          </div>
        </div>
      </Modal>
    </Spin>
  );
}
