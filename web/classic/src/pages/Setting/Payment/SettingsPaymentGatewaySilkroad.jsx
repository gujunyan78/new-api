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
import { Banner, Button, Form, Row, Col, Spin } from '@douyinfe/semi-ui';
import {
  API,
  removeTrailingSlash,
  showError,
  showSuccess,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';

export default function SettingsPaymentGatewaySilkroad(props) {
  const { t } = useTranslation();
  const sectionTitle = props.hideSectionTitle ? undefined : t('Gwiff Pay 支付设置');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    pay_silkroad_enable: false,
    pay_silkroad_sandbox: false,
    pay_silkroad_mch_id: '',
    pay_silkroad_app_id: '',
    pay_silkroad_gateway_url: '',
    pay_silkroad_sandbox_url: '',
    pay_silkroad_notify_url: '',
    pay_silkroad_private_key: '',
    pay_silkroad_platform_public_key: '',
    pay_silkroad_payment_method: 'SOLID_BANK',
    pay_silkroad_category: 1,
    pay_silkroad_currency: 'RUB',
    pay_silkroad_serial_no: '',
  });
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        pay_silkroad_enable: props.options.pay_silkroad_enable === true || props.options.pay_silkroad_enable === 'true',
        pay_silkroad_sandbox: props.options.pay_silkroad_sandbox === true || props.options.pay_silkroad_sandbox === 'true',
        pay_silkroad_mch_id: props.options.pay_silkroad_mch_id || '',
        pay_silkroad_app_id: props.options.pay_silkroad_app_id || '',
        pay_silkroad_gateway_url: props.options.pay_silkroad_gateway_url || '',
        pay_silkroad_sandbox_url: props.options.pay_silkroad_sandbox_url || '',
        pay_silkroad_notify_url: props.options.pay_silkroad_notify_url || '',
        pay_silkroad_private_key: '',
        pay_silkroad_platform_public_key: props.options.pay_silkroad_platform_public_key || '',
        pay_silkroad_payment_method: props.options.pay_silkroad_payment_method || 'SOLID_BANK',
        pay_silkroad_category: parseInt(props.options.pay_silkroad_category) || 1,
        pay_silkroad_currency: props.options.pay_silkroad_currency || 'RUB',
        pay_silkroad_serial_no: props.options.pay_silkroad_serial_no || '',
      };

      setInputs(currentInputs);
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(values);
  };

  const submitSettings = async () => {
    setLoading(true);
    try {
      if (inputs.pay_silkroad_enable) {
        const requiredFields = [
          { key: 'pay_silkroad_mch_id', label: t('商户号') },
          { key: 'pay_silkroad_app_id', label: t('应用 ID') },
          { key: 'pay_silkroad_gateway_url', label: t('网关请求地址') },
          { key: 'pay_silkroad_notify_url', label: t('异步回调地址') },
          { key: 'pay_silkroad_platform_public_key', label: t('平台公钥') },
        ];

        const emptyFields = requiredFields.filter(
          (f) => !inputs[f.key] || inputs[f.key].trim() === ''
        );

        if (emptyFields.length > 0) {
          showError(
            t('启用 Gwiff Pay 需要填写以下必填项：') +
              ' ' +
              emptyFields.map((f) => f.label).join('、')
          );
          setLoading(false);
          return;
        }
      }

      const options = [
        { key: 'pay_silkroad_enable', value: inputs.pay_silkroad_enable ? 'true' : 'false' },
        { key: 'pay_silkroad_sandbox', value: inputs.pay_silkroad_sandbox ? 'true' : 'false' },
        { key: 'pay_silkroad_mch_id', value: inputs.pay_silkroad_mch_id },
        { key: 'pay_silkroad_app_id', value: inputs.pay_silkroad_app_id },
        { key: 'pay_silkroad_gateway_url', value: removeTrailingSlash(inputs.pay_silkroad_gateway_url) },
        { key: 'pay_silkroad_sandbox_url', value: removeTrailingSlash(inputs.pay_silkroad_sandbox_url) },
        { key: 'pay_silkroad_notify_url', value: removeTrailingSlash(inputs.pay_silkroad_notify_url) },
        { key: 'pay_silkroad_platform_public_key', value: inputs.pay_silkroad_platform_public_key },
        { key: 'pay_silkroad_payment_method', value: inputs.pay_silkroad_payment_method },
        { key: 'pay_silkroad_category', value: String(inputs.pay_silkroad_category) },
        { key: 'pay_silkroad_currency', value: inputs.pay_silkroad_currency },
        { key: 'pay_silkroad_serial_no', value: inputs.pay_silkroad_serial_no },
      ];

      if (inputs.pay_silkroad_private_key && inputs.pay_silkroad_private_key.trim() !== '') {
        options.push({ key: 'pay_silkroad_private_key', value: inputs.pay_silkroad_private_key });
      }

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
        props.refresh && props.refresh();
      }
    } catch (error) {
      showError(t('更新失败'));
    }
    setLoading(false);
  };

  return (
    <Spin spinning={loading}>
      <Form
        initValues={inputs}
        onValueChange={handleFormChange}
        getFormApi={(api) => (formApiRef.current = api)}
      >
        <Form.Section text={sectionTitle}>
          <Banner
            type='info'
            icon={<Info size={16} />}
            description={t('Gwiff Pay 支付平台配置，用于处理支付业务。签名算法固定为 RSA-SHA256。')}
            style={{ marginBottom: 16 }}
          />

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Switch
                field='pay_silkroad_enable'
                label={t('启用 Gwiff Pay')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Switch
                field='pay_silkroad_sandbox'
                label={t('启用沙盒模式')}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='pay_silkroad_mch_id'
                label={t('商户号')}
                placeholder={t('平台分配的唯一商户编号')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='pay_silkroad_app_id'
                label={t('应用 ID')}
                placeholder={t('平台分配的应用 ID')}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='pay_silkroad_gateway_url'
                label={t('正式网关地址')}
                placeholder={t('例如：https://api.gwiff.com')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='pay_silkroad_sandbox_url'
                label={t('沙盒网关地址')}
                placeholder={t('例如：https://sandbox.gwiff.com')}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='pay_silkroad_notify_url'
                label={t('异步回调地址')}
                placeholder={t('例如：https://yourdomain.com/api/silkroad/notify')}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.TextArea
                field='pay_silkroad_private_key'
                label={t('商户私钥')}
                placeholder={t('PEM 格式私钥，敏感数据加密存储')}
                rows={4}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.TextArea
                field='pay_silkroad_platform_public_key'
                label={t('平台公钥')}
                placeholder={t('PEM 格式平台公钥，用于验签')}
                rows={4}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Select
                field='pay_silkroad_payment_method'
                label={t('支付方式')}
                optionList={[
                  { label: 'SOLID_BANK', value: 'SOLID_BANK' },
                ]}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='pay_silkroad_serial_no'
                label={t('证书序列号')}
                placeholder={t('商户证书序列号')}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.InputNumber
                field='pay_silkroad_category'
                label={t('交易种类')}
                placeholder={t('1-实物交易，2-服务交易')}
                min={1}
                max={2}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='pay_silkroad_currency'
                label={t('币种')}
                placeholder={t('例如：RUB')}
              />
            </Col>
          </Row>

          <Button
            block
            onClick={submitSettings}
            style={{ marginTop: '2rem' }}
          >
            {t('保存 Gwiff Pay 设置')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}