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

export default function SettingsPaymentGatewayWepay(props) {
  const { t } = useTranslation();
  const sectionTitle = props.hideSectionTitle ? undefined : t('Wepay 支付设置');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    WepayEnabled: false,
    WepaySandbox: false,
    WepayMerchantId: '',
    SbpPrivateKey: '',
    SbpPublicKey: '',
    SbpCallbackUrl: '',
    SbpNotifyUrl: '',
    SbpPlatformUrl: '',
    SbpSandboxUrl: '',
    SbpLogo: '',
    MirPrivateKey: '',
    MirPublicKey: '',
    MirCallbackUrl: '',
    MirNotifyUrl: '',
    MirPlatformUrl: '',
    MirSandboxUrl: '',
    MirLogo: '',
  });
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        WepayEnabled: props.options.WepayEnabled || false,
        WepaySandbox: props.options.WepaySandbox || false,
        WepayMerchantId: props.options.WepayMerchantId || '',
        SbpPrivateKey: props.options.SbpPrivateKey || '',
        SbpPublicKey: props.options.SbpPublicKey || '',
        SbpCallbackUrl: props.options.SbpCallbackUrl || '',
        SbpNotifyUrl: props.options.SbpNotifyUrl || '',
        SbpPlatformUrl: props.options.SbpPlatformUrl || '',
        SbpSandboxUrl: props.options.SbpSandboxUrl || '',
        SbpLogo: props.options.SbpLogo || '',
        MirPrivateKey: props.options.MirPrivateKey || '',
        MirPublicKey: props.options.MirPublicKey || '',
        MirCallbackUrl: props.options.MirCallbackUrl || '',
        MirNotifyUrl: props.options.MirNotifyUrl || '',
        MirPlatformUrl: props.options.MirPlatformUrl || '',
        MirSandboxUrl: props.options.MirSandboxUrl || '',
        MirLogo: props.options.MirLogo || '',
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
      const options = [
        { key: 'WepayEnabled', value: inputs.WepayEnabled ? 'true' : 'false' },
        { key: 'WepaySandbox', value: inputs.WepaySandbox ? 'true' : 'false' },
        { key: 'WepayMerchantId', value: inputs.WepayMerchantId },
        { key: 'SbpPrivateKey', value: inputs.SbpPrivateKey },
        { key: 'SbpPublicKey', value: inputs.SbpPublicKey },
        { key: 'SbpCallbackUrl', value: inputs.SbpCallbackUrl },
        { key: 'SbpNotifyUrl', value: inputs.SbpNotifyUrl },
        { key: 'SbpPlatformUrl', value: removeTrailingSlash(inputs.SbpPlatformUrl) },
        { key: 'SbpSandboxUrl', value: removeTrailingSlash(inputs.SbpSandboxUrl) },
        { key: 'SbpLogo', value: inputs.SbpLogo },
        { key: 'MirPrivateKey', value: inputs.MirPrivateKey },
        { key: 'MirPublicKey', value: inputs.MirPublicKey },
        { key: 'MirCallbackUrl', value: inputs.MirCallbackUrl },
        { key: 'MirNotifyUrl', value: inputs.MirNotifyUrl },
        { key: 'MirPlatformUrl', value: removeTrailingSlash(inputs.MirPlatformUrl) },
        { key: 'MirSandboxUrl', value: removeTrailingSlash(inputs.MirSandboxUrl) },
        { key: 'MirLogo', value: inputs.MirLogo },
      ];

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
            description={t('Wepay 支付平台配置（SBP + MIR），用于处理俄罗斯地区的支付业务。')}
            style={{ marginBottom: 16 }}
          />
          
          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Switch
                field='WepayEnabled'
                label={t('启用 Wepay')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Switch
                field='WepaySandbox'
                label={t('启用沙盒模式')}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='WepayMerchantId'
                label={t('商户号 Merchant Id')}
                placeholder={t('商户编号')}
              />
            </Col>
          </Row>

          <Banner
            type='info'
            icon={<Info size={16} />}
            description={t('SBP 支付平台配置')}
            style={{ marginTop: 16, marginBottom: 16 }}
          />

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='SbpPlatformUrl'
                label={t('SBP 支付平台地址')}
                placeholder={t('例如：https://api.sbp.ru')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='SbpSandboxUrl'
                label={t('SBP 支付平台沙盒地址')}
                placeholder={t('例如：https://sandbox.sbp.ru')}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='SbpPrivateKey'
                label={t('SBP 商户 PrivateKey')}
                placeholder={t('商户私钥')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='SbpPublicKey'
                label={t('SBP 平台 PublicKey')}
                placeholder={t('平台公钥')}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='SbpCallbackUrl'
                label={t('SBP 回弹地址 Callback Url')}
                placeholder={t('例如：https://yourdomain.com/api/payment/callback')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='SbpNotifyUrl'
                label={t('SBP 回调通知地址 Notify Url')}
                placeholder={t('例如：https://yourdomain.com/api/payment/notify')}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='SbpLogo'
                label={t('SBP 前台显示 Logo')}
                placeholder={t('Logo 图片 URL')}
              />
            </Col>
          </Row>

          <Banner
            type='info'
            icon={<Info size={16} />}
            description={t('MIR 支付平台配置')}
            style={{ marginTop: 16, marginBottom: 16 }}
          />

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='MirPlatformUrl'
                label={t('MIR 支付平台地址')}
                placeholder={t('例如：https://api.mir.ru')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='MirSandboxUrl'
                label={t('MIR 支付平台沙盒地址')}
                placeholder={t('例如：https://sandbox.mir.ru')}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='MirPrivateKey'
                label={t('MIR 商户 PrivateKey')}
                placeholder={t('商户私钥')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='MirPublicKey'
                label={t('MIR 平台 PublicKey')}
                placeholder={t('平台公钥')}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='MirCallbackUrl'
                label={t('MIR 回弹地址 Callback Url')}
                placeholder={t('例如：https://yourdomain.com/api/payment/callback')}
              />
            </Col>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='MirNotifyUrl'
                label={t('MIR 回调通知地址 Notify Url')}
                placeholder={t('例如：https://yourdomain.com/api/payment/notify')}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={12} lg={12} xl={12}>
              <Form.Input
                field='MirLogo'
                label={t('MIR 前台显示 Logo')}
                placeholder={t('Logo 图片 URL')}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={24} sm={24} md={24} lg={24} xl={24}>
              <Button
                type='primary'
                theme='solid'
                onClick={submitSettings}
                loading={loading}
              >
                {t('保存设置')}
              </Button>
            </Col>
          </Row>
        </Form.Section>
      </Form>
    </Spin>
  );
}