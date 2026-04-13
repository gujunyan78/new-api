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
import { Tag, Typography } from '@douyinfe/semi-ui';
import { timestamp2string } from '../../../helpers';

const { Text } = Typography;

const parseExtraInfo = (extraInfo) => {
  if (!extraInfo) return {};
  try {
    return JSON.parse(extraInfo);
  } catch {
    return {};
  }
};

const getAdminTopUpLabel = (amount, t) => {
  return amount < 0 ? t('管理员红冲') : t('管理员充值');
};

export const getTopupsColumns = ({ t }) => {
  return [
    {
      title: t('订单号'),
      dataIndex: 'trade_no',
      key: 'trade_no',
      render: (text) => <Text copyable>{text}</Text>,
    },
    {
      title: t('目标用户'),
      key: 'user',
      render: (_, record) => {
        const username = record.username || record.Username;
        if (username) {
          return (
            <Text>
              {username} (ID: {record.user_id})
            </Text>
          );
        }
        return record.user_id;
      },
    },
    {
      title: t('金额'),
      dataIndex: 'money',
      key: 'money',
      render: (money) => (
        <Text type={money < 0 ? 'danger' : 'success'}>
          ${money?.toFixed(2)}
        </Text>
      ),
    },
    {
      title: t('操作人'),
      key: 'operator_name',
      render: (_, record) => {
        const info = parseExtraInfo(record.extra_info);
        return info.operator_name || '-';
      },
    },
    {
      title: t('备注'),
      key: 'remark',
      render: (_, record) => {
        const info = parseExtraInfo(record.extra_info);
        return info.remark || '-';
      },
    },
    {
      title: t('创建时间'),
      dataIndex: 'create_time',
      key: 'create_time',
      render: (time) => timestamp2string(time),
    },
    {
      title: t('支付方式'),
      key: 'payment_label',
      render: (_, record) => {
        const label = getAdminTopUpLabel(record.money, t);
        const color = record.money < 0 ? 'red' : 'green';
        return <Tag color={color}>{label}</Tag>;
      },
    },
  ];
};
