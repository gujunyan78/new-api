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

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import { useTableCompactMode } from '../common/useTableCompactMode';

export const useTopupsData = () => {
  const { t } = useTranslation();
  const [compactMode, setCompactMode] = useTableCompactMode('topups');

  const [topups, setTopups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [topupCount, setTopupCount] = useState(0);
  const [formInitValues] = useState({
    searchKeyword: '',
    orderBy: '',
  });
  const [formApi, setFormApi] = useState(null);

  const [showTopupModal, setShowTopupModal] = useState(false);

  const getQueryParams = useCallback(
    (currentPage, currentPageSize, form) => {
      let params = `p=${currentPage}&page_size=${currentPageSize}`;
      const searchKeyword = form?.searchKeyword || '';
      const orderBy = form?.orderBy || '';

      if (searchKeyword) {
        params += `&keyword=${encodeURIComponent(searchKeyword)}`;
      }
      if (orderBy) {
        params += `&order_by=${encodeURIComponent(orderBy)}`;
      }
      return params;
    },
    [],
  );

  const loadTopups = useCallback(
    async (currentPage, currentPageSize) => {
      setLoading(true);
      try {
        const formValues = formApi ? formApi.getValues() : {};
        const params = getQueryParams(currentPage, currentPageSize, formValues);
        const res = await API.get(`/api/user/topup?${params}`, {
          disableDuplicate: true,
        });
        const { success, message, data } = res.data;
        if (success) {
          const allItems = data?.items || [];
          const filtered = allItems.filter(
            (item) => item.payment_method === 'admin_topup',
          );
          setTopups(filtered);
          setTopupCount(data?.total || 0);
          setActivePage(data?.page || currentPage);
        } else {
          showError(message || t('加载失败'));
        }
      } catch {
        showError(t('加载失败'));
      } finally {
        setLoading(false);
      }
    },
    [t, getQueryParams, formApi],
  );

  const searchTopups = useCallback(
    async (currentPage, currentPageSize) => {
      setSearching(true);
      setLoading(true);
      try {
        const formValues = formApi ? formApi.getValues() : {};
        const params = getQueryParams(currentPage, currentPageSize, formValues);
        const res = await API.get(`/api/user/topup?${params}`, {
          disableDuplicate: true,
        });
        const { success, message, data } = res.data;
        if (success) {
          const allItems = data?.items || [];
          const filtered = allItems.filter(
            (item) => item.payment_method === 'admin_topup',
          );
          setTopups(filtered);
          setTopupCount(data?.total || 0);
          setActivePage(data?.page || currentPage);
        } else {
          showError(message || t('加载失败'));
        }
      } catch {
        showError(t('加载失败'));
      } finally {
        setLoading(false);
        setSearching(false);
      }
    },
    [t, getQueryParams, formApi],
  );

  const handlePageChange = (page) => {
    setActivePage(page);
    loadTopups(page, pageSize);
  };

  const handlePageSizeChange = async (size) => {
    localStorage.setItem('page-size', size + '');
    setPageSize(size);
    setActivePage(1);
    loadTopups(activePage, size);
  };

  const handleTopUpSuccess = useCallback(() => {
    setShowTopupModal(false);
    loadTopups(activePage, pageSize);
  }, [activePage, pageSize, loadTopups]);

  const refresh = useCallback(async (page = activePage) => {
    await loadTopups(page, pageSize);
  }, [activePage, pageSize, loadTopups]);

  useEffect(() => {
    loadTopups(activePage, pageSize);
  }, [activePage, pageSize, loadTopups]);

  return {
    topups,
    loading,
    searching,
    activePage,
    pageSize,
    topupCount,
    compactMode,
    setCompactMode,
    showTopupModal,
    setShowTopupModal,
    handlePageChange,
    handlePageSizeChange,
    handleTopUpSuccess,
    refresh,
    loadTopups,
    searchTopups,
    formInitValues,
    setFormApi,
    t,
  };
};
