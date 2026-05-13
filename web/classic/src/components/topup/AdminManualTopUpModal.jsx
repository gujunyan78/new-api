import React, { useState, useCallback, useRef } from 'react';
import {
  Modal,
  Form,
  Toast,
  Select,
  InputNumber,
  TextArea,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers';

const AdminManualTopUpModal = ({ visible, onCancel, onSuccess }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [userOptions, setUserOptions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const formRef = React.useRef();
  const searchTimerRef = useRef(null);

  const loadUsers = useCallback(async (keyword = '') => {
    setSearchLoading(true);
    try {
      let res;
      if (keyword) {
        res = await API.get(
          `/api/user/search?keyword=${encodeURIComponent(keyword)}&p=1&page_size=20`,
          { disableDuplicate: true },
        );
      } else {
        res = await API.get(
          `/api/user/?p=1&page_size=50`,
          { disableDuplicate: true },
        );
      }
      const { success, data } = res.data;
      if (success && data?.items) {
        setUserOptions(
          data.items.map((u) => ({
            value: u.id,
            label: `${u.username} (ID: ${u.id})`,
          })),
        );
      }
    } catch {
      // ignore search errors
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleUserSearch = useCallback((keyword) => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
      loadUsers(keyword);
    }, keyword ? 300 : 0);
  }, [loadUsers]);

  // 当弹窗打开时加载用户列表
  React.useEffect(() => {
    if (visible) {
      loadUsers('');
    }
  }, [visible, loadUsers]);

  const doSubmit = async (values) => {
    setLoading(true);
    try {
      const res = await API.post('/api/user/topup/admin', {
        user_id: values.user_id,
        amount: values.amount,
        remark: values.remark || '',
      });
      const { success, message } = res.data;
      if (success) {
        Toast.success({ content: t('充值成功') });
        formRef.current?.formApi?.reset();
        onSuccess?.();
      } else {
        Toast.error({ content: message || t('充值失败') });
      }
    } catch {
      Toast.error({ content: t('充值失败') });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    formRef.current?.formApi?.validate().then((values) => {
      if (values.amount < 0) {
        Modal.confirm({
          title: t('红冲确认'),
          content: t('您输入了负数金额，这将执行红冲（冲销）操作，目标用户余额可能变为负数。确认继续？'),
          okType: 'danger',
          onOk: () => doSubmit(values),
        });
      } else {
        doSubmit(values);
      }
    });
  };

  const handleCancel = () => {
    formRef.current?.formApi?.reset();
    onCancel?.();
  };

  return (
    <Modal
      title={t('新建手工充值')}
      visible={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      okText={t('提交充值')}
      cancelText={t('取消')}
      confirmLoading={loading}
      maskClosable={false}
    >
      <Form ref={formRef} labelPosition='top'>
        <Form.Select
          field='user_id'
          label={t('用户')}
          placeholder={t('搜索用户')}
          filter
          remote
          onSearch={handleUserSearch}
          optionList={userOptions}
          loading={searchLoading}
          showClear
          emptyContent={null}
          rules={[{ required: true, message: t('请选择用户') }]}
          style={{ width: '100%' }}
        />
        <Form.InputNumber
          field='amount'
          label={t('充值金额')}
          placeholder={t('正数充值，负数红冲，不允许为0')}
          rules={[
            { required: true, message: t('请输入充值金额') },
            {
              validator: (_, value) =>
                value !== 0 && value !== undefined && value !== null,
              message: t('充值金额不能为零'),
            },
          ]}
          style={{ width: '100%' }}
        />
        <Form.TextArea
          field='remark'
          label={t('备注')}
          placeholder={t('可选备注信息')}
          maxCount={200}
          style={{ width: '100%' }}
        />
      </Form>
    </Modal>
  );
};

export default AdminManualTopUpModal;
