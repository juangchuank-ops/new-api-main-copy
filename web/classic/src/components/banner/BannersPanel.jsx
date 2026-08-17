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

import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Skeleton,
  Empty,
  Tooltip,
  Typography,
  Modal,
  Form,
  Space,
} from '@douyinfe/semi-ui';
import { Plus, RefreshCw, Edit2, Trash2, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../helpers';

const { Text } = Typography;

const BANNER_TYPES = ['default', 'ongoing', 'success', 'warning', 'error'];

const BANNER_TYPE_COLORS = {
  default: 'grey',
  ongoing: 'blue',
  success: 'green',
  warning: 'orange',
  error: 'red',
};

const BANNER_SORT_ORDER_MIN = -2147483648;
const BANNER_SORT_ORDER_MAX = 2147483647;

const MAX_CONTENT_LENGTH = 500;
const MAX_EXTRA_LENGTH = 200;
const MAX_LINK_LENGTH = 500;

function toRFC3339(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

function fromRFC3339(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatBannerDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function getPreviewText(text, maxLen = 80) {
  if (!text) return '';
  const str = String(text);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '…';
}

function isSafeLink(link) {
  if (!link) return true;
  try {
    const url = new URL(link);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function getDefaultFormValues() {
  return {
    content: '',
    publishDate: new Date(),
    type: 'default',
    extra: '',
    enabled: true,
    sortOrder: 0,
    startDate: null,
    endDate: null,
    link: '',
  };
}

function bannerToFormValues(banner) {
  return {
    content: banner.content || '',
    publishDate: fromRFC3339(banner.publishDate) || new Date(),
    type: BANNER_TYPES.includes(banner.type) ? banner.type : 'default',
    extra: banner.extra || '',
    enabled: banner.enabled !== false,
    sortOrder: typeof banner.sortOrder === 'number' ? banner.sortOrder : 0,
    startDate: fromRFC3339(banner.startDate),
    endDate: fromRFC3339(banner.endDate),
    link: banner.link || '',
  };
}

function formValuesToPayload(values) {
  return {
    content: values.content,
    publishDate: toRFC3339(values.publishDate),
    type: values.type,
    extra: values.extra || '',
    enabled: values.enabled,
    sortOrder: values.sortOrder ?? 0,
    startDate: values.startDate ? toRFC3339(values.startDate) : '',
    endDate: values.endDate ? toRFC3339(values.endDate) : '',
    link: (values.link || '').trim(),
  };
}

function validateFormValues(values, t) {
  if (!values.content || !values.content.trim()) {
    return t('内容为必填项');
  }
  if (values.content.length > MAX_CONTENT_LENGTH) {
    return t('内容最多 {{max}} 个字符', { max: MAX_CONTENT_LENGTH });
  }
  if (values.extra && values.extra.length > MAX_EXTRA_LENGTH) {
    return t('备注最多 {{max}} 个字符', { max: MAX_EXTRA_LENGTH });
  }
  if (values.link && values.link.length > MAX_LINK_LENGTH) {
    return t('链接最多 {{max}} 个字符', { max: MAX_LINK_LENGTH });
  }
  if (values.link && !isSafeLink(values.link)) {
    return t('链接必须是有效的 HTTP 或 HTTPS URL');
  }
  if (values.startDate && values.endDate) {
    const start =
      values.startDate instanceof Date
        ? values.startDate
        : new Date(values.startDate);
    const end =
      values.endDate instanceof Date
        ? values.endDate
        : new Date(values.endDate);
    if (start.getTime() > end.getTime()) {
      return t('开始日期不能晚于结束日期');
    }
  }
  return null;
}

const BannersPanel = () => {
  const { t } = useTranslation();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const [showDialog, setShowDialog] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const formApiRef = useRef(null);
  const [formKey, setFormKey] = useState(0);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      const res = await API.get('/api/banner', { skipErrorHandler: true });
      if (!res.data?.success) throw new Error(res.data?.message);
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      const sorted = [...data].sort((a, b) => {
        const sd = (b.sortOrder ?? 0) - (a.sortOrder ?? 0);
        if (sd !== 0) return sd;
        const pa = a.publishDate ? new Date(a.publishDate).getTime() : 0;
        const pb = b.publishDate ? new Date(b.publishDate).getTime() : 0;
        return pb - pa;
      });
      setBanners(sorted);
    } catch (err) {
      setError(true);
      if (!isRefresh) setBanners([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    setEditingBanner(null);
    setFormKey((k) => k + 1);
    setShowDialog(true);
  };

  const handleEdit = (banner) => {
    setEditingBanner(banner);
    setFormKey((k) => k + 1);
    setShowDialog(true);
  };

  const submit = async (values) => {
    // `values` from onSubmit is the authoritative submitted form state.
    // Merge with getValues() as a fallback: if getValues() returns an empty
    // object (truthy but empty), it must not shadow the real submitted values,
    // otherwise validateFormValues would wrongly report missing fields.
    const formValues = {
      ...(formApiRef.current?.getValues() || {}),
      ...(values || {}),
    };
    const errMsg = validateFormValues(formValues, t);
    if (errMsg) {
      showError(errMsg);
      return;
    }
    const payload = formValuesToPayload(formValues);
    setSaving(true);
    try {
      let res;
      if (editingBanner) {
        res = await API.put(`/api/banner/${editingBanner.id}`, payload, {
          skipErrorHandler: true,
        });
      } else {
        res = await API.post('/api/banner', payload, {
          skipErrorHandler: true,
        });
      }
      if (!res.data?.success) throw new Error(res.data?.message);
      showSuccess(editingBanner ? t('横幅更新成功') : t('横幅创建成功'));
      setShowDialog(false);
      setEditingBanner(null);
      await fetchData(true);
    } catch (err) {
      showError(
        err instanceof Error && err.message
          ? err.message
          : t('保存失败，请重试'),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = () => {
    formApiRef.current?.submitForm();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await API.delete(`/api/banner/${deleteTarget.id}`, {
        skipErrorHandler: true,
      });
      if (!res.data?.success) throw new Error(res.data?.message);
      showSuccess(t('横幅删除成功'));
      setDeleteTarget(null);
      await fetchData(true);
    } catch (err) {
      showError(
        err instanceof Error && err.message
          ? err.message
          : t('删除失败，请重试'),
      );
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        title: t('内容'),
        dataIndex: 'content',
        width: 240,
        render: (text) => (
          <Tooltip content={text} style={{ maxWidth: 400 }}>
            <span
              className='truncate font-medium'
              style={{ fontSize: 13, display: 'inline-block', maxWidth: 220 }}
            >
              {getPreviewText(text, 60)}
            </span>
          </Tooltip>
        ),
      },
      {
        title: t('状态'),
        dataIndex: 'enabled',
        width: 90,
        render: (enabled) => (
          <Tag color={enabled ? 'green' : 'grey'} size='small'>
            {enabled ? t('已启用') : t('已禁用')}
          </Tag>
        ),
      },
      {
        title: t('类型'),
        dataIndex: 'type',
        width: 100,
        render: (type) => {
          const safeType = BANNER_TYPES.includes(type) ? type : 'default';
          return (
            <Tag color={BANNER_TYPE_COLORS[safeType]} size='small'>
              {t(safeType)}
            </Tag>
          );
        },
      },
      {
        title: t('排序'),
        dataIndex: 'sortOrder',
        width: 80,
        render: (val) => (
          <span className='font-mono tabular-nums' style={{ fontSize: 12 }}>
            {typeof val === 'number' ? val : 0}
          </span>
        ),
      },
      {
        title: t('发布日期'),
        dataIndex: 'publishDate',
        width: 160,
        render: (val) => (
          <span
            style={{
              fontSize: 12,
              color: 'var(--semi-color-text-2)',
              whiteSpace: 'nowrap',
            }}
          >
            {formatBannerDate(val)}
          </span>
        ),
      },
      {
        title: t('展示窗口'),
        dataIndex: 'startDate',
        width: 180,
        render: (_, record) => (
          <div
            className='flex flex-col gap-1'
            style={{ fontSize: 11, color: 'var(--semi-color-text-2)' }}
          >
            <span>
              <Text type='tertiary' size='small'>
                {t('开始')}:
              </Text>{' '}
              {formatBannerDate(record.startDate)}
            </span>
            <span>
              <Text type='tertiary' size='small'>
                {t('结束')}:
              </Text>{' '}
              {formatBannerDate(record.endDate)}
            </span>
          </div>
        ),
      },
      {
        title: t('链接'),
        dataIndex: 'link',
        width: 90,
        render: (link) =>
          link ? (
            <a
              href={link}
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-1'
              style={{ color: 'var(--semi-color-primary)', fontSize: 12 }}
            >
              {t('打开')}
              <ExternalLink size={12} />
            </a>
          ) : (
            '—'
          ),
      },
      {
        title: t('备注'),
        dataIndex: 'extra',
        width: 140,
        render: (text) => (
          <span style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>
            {text ? getPreviewText(text, 30) : '—'}
          </span>
        ),
      },
      {
        title: t('操作'),
        dataIndex: 'actions',
        width: 120,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Button
              size='small'
              theme='borderless'
              icon={<Edit2 size={14} />}
              onClick={() => handleEdit(record)}
            >
              {t('编辑')}
            </Button>
            <Button
              size='small'
              theme='borderless'
              type='danger'
              icon={<Trash2 size={14} />}
              onClick={() => setDeleteTarget(record)}
            >
              {t('删除')}
            </Button>
          </Space>
        ),
      },
    ],
    [t],
  );

  const dialogTitle = editingBanner ? t('编辑横幅') : t('添加横幅');

  return (
    <>
      <Card
        bordered
        headerLine
        title={
          <div className='flex items-center gap-2'>
            <Text strong style={{ fontSize: 14 }}>
              {t('横幅列表')}
            </Text>
          </div>
        }
        headerExtraContent={
          <Space>
            <Button
              icon={<Plus size={14} />}
              size='small'
              theme='solid'
              onClick={handleAdd}
            >
              {t('添加横幅')}
            </Button>
            <Button
              icon={<RefreshCw size={14} />}
              size='small'
              theme='borderless'
              loading={refreshing}
              onClick={() => fetchData(true)}
            >
              {t('刷新')}
            </Button>
          </Space>
        }
      >
        {loading ? (
          <div className='flex flex-col gap-2'>
            {[1, 2, 3].map((key) => (
              <Skeleton key={key} className='!h-9 !w-full' />
            ))}
          </div>
        ) : error ? (
          <div className='flex flex-col items-center justify-center gap-3 py-8'>
            <Text type='tertiary' size='small'>
              {t('加载失败')}
            </Text>
            <Button size='small' theme='borderless' onClick={() => fetchData()}>
              {t('重试')}
            </Button>
          </div>
        ) : banners.length === 0 ? (
          <div className='flex items-center justify-center py-8'>
            <Empty
              description={t('暂无横幅，点击"添加横幅"创建')}
              style={{ padding: 0 }}
            />
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={banners}
            rowKey='id'
            pagination={false}
            size='small'
            scroll={{ x: 1200 }}
          />
        )}
      </Card>

      <Modal
        title={dialogTitle}
        visible={showDialog}
        onCancel={() => {
          if (saving) return;
          setShowDialog(false);
          setEditingBanner(null);
        }}
        footer={
          <Space>
            <Button
              disabled={saving}
              onClick={() => {
                setShowDialog(false);
                setEditingBanner(null);
              }}
            >
              {t('取消')}
            </Button>
            <Button
              theme='solid'
              type='primary'
              loading={saving}
              onClick={handleSubmit}
            >
              {editingBanner ? t('更新') : t('添加')}
            </Button>
          </Space>
        }
        width={680}
      >
        <Form
          key={formKey}
          getFormApi={(api) => (formApiRef.current = api)}
          initValues={
            editingBanner
              ? bannerToFormValues(editingBanner)
              : getDefaultFormValues()
          }
          onSubmit={submit}
          onSubmitFail={(errs) => {
            const first = Object.values(errs)[0];
            if (first) showError(Array.isArray(first) ? first[0] : first);
          }}
          layout='vertical'
          labelPosition='top'
          className='banner-form'
        >
          <div className='flex flex-col' style={{ gap: 18, paddingTop: 4 }}>
            <Form.TextArea
              field='content'
              label={t('内容')}
              placeholder={t('输入横幅内容（支持 Markdown/HTML）')}
              rows={2}
              maxCount={MAX_CONTENT_LENGTH}
              showClear
              rules={[{ required: true, message: t('内容为必填项') }]}
            />
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <Form.Select
                field='type'
                label={t('类型')}
                style={{ width: '100%' }}
                optionList={BANNER_TYPES.map((tp) => ({
                  value: tp,
                  label: t(tp),
                }))}
              />
              <Form.InputNumber
                field='sortOrder'
                label={t('排序')}
                min={BANNER_SORT_ORDER_MIN}
                max={BANNER_SORT_ORDER_MAX}
                step={1}
                style={{ width: '100%' }}
              />
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <Form.DatePicker
                field='publishDate'
                label={t('发布日期')}
                type='dateTime'
                style={{ width: '100%' }}
                rules={[{ required: true, message: t('发布日期为必填项') }]}
              />
              <div>
                <label
                  className='semi-form-field-label'
                  style={{ display: 'block', marginBottom: 8 }}
                >
                  {t('启用')}
                </label>
                <Form.Switch
                  field='enabled'
                  checkedText={t('开')}
                  uncheckedText={t('关')}
                />
                <Text
                  type='tertiary'
                  size='small'
                  style={{ display: 'block', marginTop: 4 }}
                >
                  {t('在公共页面显示此横幅')}
                </Text>
              </div>
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <Form.DatePicker
                field='startDate'
                label={t('开始日期')}
                type='dateTime'
                style={{ width: '100%' }}
                placeholder={t('可选')}
              />
              <Form.DatePicker
                field='endDate'
                label={t('结束日期')}
                type='dateTime'
                style={{ width: '100%' }}
                placeholder={t('可选')}
              />
            </div>
            <div>
              <Form.Input
                field='link'
                label={t('链接')}
                placeholder={t('输入 URL...')}
                showClear
              />
              <Text
                type='tertiary'
                size='small'
                style={{ display: 'block', marginTop: 6 }}
              >
                {t('可选的 HTTP 或 HTTPS 目标链接')}
              </Text>
            </div>
            <Form.Input
              field='extra'
              label={t('备注（可选）')}
              placeholder={t('附加信息')}
              showClear
              maxCount={MAX_EXTRA_LENGTH}
            />
          </div>
        </Form>
      </Modal>

      <Modal
        title={t('删除横幅？')}
        visible={deleteTarget !== null}
        onCancel={() => {
          if (deleting) return;
          setDeleteTarget(null);
        }}
        footer={
          <Space>
            <Button disabled={deleting} onClick={() => setDeleteTarget(null)}>
              {t('取消')}
            </Button>
            <Button
              theme='solid'
              type='danger'
              loading={deleting}
              onClick={handleDelete}
            >
              {t('删除')}
            </Button>
          </Space>
        }
      >
        <Text>{t('此横幅将被永久删除。')}</Text>
      </Modal>
    </>
  );
};

export default BannersPanel;
