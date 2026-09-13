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

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@douyinfe/semi-ui';
import {
  API,
  copy,
  getTodayStartTimestamp,
  isAdmin,
  showError,
  showSuccess,
  timestamp2string,
} from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';

export const useAuditLogsData = () => {
  const { t } = useTranslation();

  const isAdminUser = isAdmin();
  const scope = isAdminUser ? 'all' : 'self';

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [logCount, setLogCount] = useState(0);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [formApi, setFormApi] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const now = new Date();
  const formInitValues = {
    username: '',
    category: 'all',
    success: 'all',
    token_ref: '',
    request_id: '',
    dateRange: [
      timestamp2string(getTodayStartTimestamp()),
      timestamp2string(now.getTime() / 1000 + 3600),
    ],
  };

  const getFormValues = () => {
    const values = formApi ? formApi.getValues() : {};

    let start_timestamp = Math.floor(
      Date.parse(formInitValues.dateRange[0]) / 1000,
    );
    let end_timestamp = Math.floor(
      Date.parse(formInitValues.dateRange[1]) / 1000,
    );
    if (
      values.dateRange &&
      Array.isArray(values.dateRange) &&
      values.dateRange.length === 2
    ) {
      start_timestamp = Math.floor(Date.parse(values.dateRange[0]) / 1000);
      end_timestamp = Math.floor(Date.parse(values.dateRange[1]) / 1000);
    }

    return {
      username: isAdminUser ? values.username || '' : '',
      category:
        values.category && values.category !== 'all' ? values.category : '',
      success: values.success && values.success !== 'all' ? values.success : '',
      token_ref: values.token_ref || '',
      request_id: values.request_id || '',
      start_timestamp,
      end_timestamp,
    };
  };

  const setLogsFormat = (items) => {
    const formatted = (items || []).map((item) => ({
      ...item,
      key: item.event_id || String(item.id),
      timestamp2string: timestamp2string(item.created_at),
    }));
    setLogs(formatted);
  };

  const loadLogs = async (startIdx, size) => {
    setLoading(true);

    const params = getFormValues();
    const query = { p: startIdx, page_size: size };
    Object.entries(params).forEach(([key, value]) => {
      if (
        value !== '' &&
        value !== undefined &&
        value !== null &&
        !(typeof value === 'number' && Number.isNaN(value))
      ) {
        query[key] = value;
      }
    });

    const res = await API.get(
      isAdminUser ? '/api/audit' : '/api/audit/self',
      { params: query },
    );
    const { success, message, data } = res.data;
    if (success) {
      setActivePage(data.page);
      setPageSize(data.page_size);
      setLogCount(data.total);
      setLogsFormat(data.items);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const handlePageChange = (page) => {
    setActivePage(page);
    loadLogs(page, pageSize);
  };

  const handlePageSizeChange = (size) => {
    localStorage.setItem('page-size', size + '');
    setPageSize(size);
    setActivePage(1);
    loadLogs(1, size);
  };

  const refresh = () => {
    setActivePage(1);
    loadLogs(1, pageSize);
  };

  const openDetail = (record) => {
    setSelectedLog(record);
    setShowDetailModal(true);
  };

  const closeDetail = () => {
    setShowDetailModal(false);
    setSelectedLog(null);
  };

  const copyText = async (event, text) => {
    if (event) {
      event.stopPropagation();
    }
    if (!text) {
      return;
    }
    if (await copy(text)) {
      showSuccess(t('已复制：') + text);
    } else {
      Modal.error({ title: t('无法复制到剪贴板，请手动复制'), content: text });
    }
  };

  useEffect(() => {
    const localPageSize =
      parseInt(localStorage.getItem('page-size')) || ITEMS_PER_PAGE;
    setPageSize(localPageSize);
    loadLogs(activePage, localPageSize);
  }, []);

  return {
    logs,
    loading,
    activePage,
    logCount,
    pageSize,
    formApi,
    setFormApi,
    formInitValues,
    isAdminUser,
    scope,
    selectedLog,
    showDetailModal,
    openDetail,
    closeDetail,
    copyText,
    loadLogs,
    handlePageChange,
    handlePageSizeChange,
    refresh,
    t,
  };
};
