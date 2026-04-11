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

export * from './history';
export * from './auth';
export * from './utils';
export * from './base64';
export * from './api';
export * from './render';
export * from './log';
export * from './data';
export * from './token';
export * from './boolean';
export * from './dashboard';
export * from './passkey';
export * from './statusCodeRules';

export const getLogo = () => {
  const status = JSON.parse(localStorage.getItem('status') || '{}');
  return status.logo || '';
};

// 处理 channel 参数的存储和获取
export const handleChannelParam = () => {
  // 从 URL 参数获取 channel
  const urlParams = new URLSearchParams(window.location.search);
  const channelFromUrl = urlParams.get('channel');
  
  if (channelFromUrl) {
    // 如果 URL 中有 channel 参数，更新 sessionStorage
    sessionStorage.setItem('channel', channelFromUrl);
  }
  
  // 返回当前的 channel 值
  return sessionStorage.getItem('channel') || '';
};