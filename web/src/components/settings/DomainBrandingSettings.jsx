import React, { useEffect, useState } from 'react';
import {
  Table,
  Modal,
  Form,
  Button,
  Popconfirm,
  Space,
  Typography,
} from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const DomainBrandingSettings = () => {
  const { t } = useTranslation();
  const [brandings, setBrandings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const formApi = React.useRef();

  const fetchBrandings = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/domain-branding/');
      const { success, message, data } = res.data;
      if (success) {
        setBrandings(data || []);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('获取域名品牌配置失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrandings();
  }, []);

  const columns = [
    {
      title: t('域名'),
      dataIndex: 'domain',
    },
    {
      title: t('系统名称'),
      dataIndex: 'system_name',
      render: (text) => text || <Text type='quaternary'>{t('使用全局默认')}</Text>,
    },
    {
      title: t('Logo 图片地址'),
      dataIndex: 'logo',
      render: (text) => text || <Text type='quaternary'>{t('使用全局默认')}</Text>,
    },
    {
      title: t('操作'),
      dataIndex: 'action',
      render: (_, record) => (
        <Space>
          <Button theme='light' type='tertiary' size='small' onClick={() => handleEdit(record)}>
            {t('编辑')}
          </Button>
          <Popconfirm
            title={t('确认删除该域名品牌配置？')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('确认')}
            cancelText={t('取消')}
          >
            <Button theme='light' type='danger' size='small'>
              {t('删除')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleEdit = (record) => {
    setEditingRecord(record);
    setModalVisible(true);
  };

  const handleAdd = () => {
    setEditingRecord(null);
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setEditingRecord(null);
  };

  const handleSubmit = async () => {
    try {
      await formApi.current.validate();
    } catch {
      return;
    }
    const values = formApi.current.getValues();
    setSubmitting(true);
    try {
      let res;
      if (editingRecord) {
        res = await API.put(`/api/domain-branding/${editingRecord.id}`, values);
      } else {
        res = await API.post('/api/domain-branding/', values);
      }
      const { success, message } = res.data;
      if (success) {
        showSuccess(editingRecord ? t('域名品牌配置更新成功') : t('域名品牌配置创建成功'));
        handleModalClose();
        fetchBrandings();
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('操作失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await API.delete(`/api/domain-branding/${id}`);
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('域名品牌配置删除成功'));
        fetchBrandings();
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('删除失败'));
    }
  };

  return (
    <>
      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text strong>{t('域名品牌配置')}</Text>
          <Button theme='light' type='primary' onClick={handleAdd}>
            {t('新增域名品牌')}
          </Button>
        </div>
        <Text type='quaternary' size='small' style={{ display: 'block', marginBottom: 12 }}>
          {t('为不同域名配置独立的品牌内容，留空的字段将回退使用全局默认设置')}
        </Text>
        <Table
          columns={columns}
          dataSource={brandings}
          rowKey='id'
          loading={loading}
          pagination={false}
          size='small'
          empty={t('暂无域名品牌配置')}
        />
      </div>

      <Modal
        title={editingRecord ? t('编辑域名品牌') : t('新增域名品牌')}
        visible={modalVisible}
        onCancel={handleModalClose}
        onOk={handleSubmit}
        okText={t('确认')}
        cancelText={t('取消')}
        confirmLoading={submitting}
        width={600}
      >
        <Form
          getFormApi={(api) => (formApi.current = api)}
          initValues={editingRecord || {}}
          labelPosition='top'
        >
          <Form.Input
            field='domain'
            label={t('域名')}
            placeholder={t('例如：api.example.com')}
            rules={[{ required: true, message: t('请输入域名') }]}
          />
          <Form.Input
            field='system_name'
            label={t('系统名称')}
            placeholder={t('留空则使用全局默认设置')}
          />
          <Form.Input
            field='logo'
            label={t('Logo 图片地址')}
            placeholder={t('留空则使用全局默认设置')}
          />
          <Form.TextArea
            field='home_page_content'
            label={t('首页内容')}
            placeholder={t('留空则使用全局默认设置')}
            autosize={{ minRows: 3, maxRows: 8 }}
            style={{ fontFamily: 'JetBrains Mono, Consolas' }}
          />
          <Form.TextArea
            field='about'
            label={t('关于')}
            placeholder={t('留空则使用全局默认设置')}
            autosize={{ minRows: 3, maxRows: 8 }}
            style={{ fontFamily: 'JetBrains Mono, Consolas' }}
          />
          <Form.TextArea
            field='footer'
            label={t('页脚')}
            placeholder={t('留空则使用全局默认设置')}
            autosize={{ minRows: 3, maxRows: 8 }}
            style={{ fontFamily: 'JetBrains Mono, Consolas' }}
          />
        </Form>
      </Modal>
    </>
  );
};

export default DomainBrandingSettings;
