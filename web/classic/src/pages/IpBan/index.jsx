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

import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Form,
  Input,
  Modal,
  Pagination,
  Radio,
  RadioGroup,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconDelete,
  IconEdit,
  IconPlus,
  IconRefresh,
  IconSearch,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess, timestamp2string } from '../../helpers';

const PAGE_SIZE = 20;
const { Title, Text } = Typography;

const IpBan = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formApi, setFormApi] = useState(null);
  const [permanent, setPermanent] = useState(true);
  const [createMode, setCreateMode] = useState('user');
  const [userKeyword, setUserKeyword] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedIp, setSelectedIp] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await API.get('/api/ip-bans', {
        params: { p: page, page_size: PAGE_SIZE, search: query },
      });
      if (!response.data.success) {
        showError(response.data.message);
        return;
      }
      const data = response.data.data || {};
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const openCreate = () => {
    setEditing(null);
    setPermanent(true);
    setCreateMode('user');
    setUserKeyword('');
    setUserResults([]);
    setSelectedUser(null);
    setSelectedIp('');
    setVisible(true);
    searchUsers('');
  };

  const openEdit = (item) => {
    setEditing(item);
    setPermanent(item.expires_at === 0);
    setCreateMode(item.target_user_id ? 'user' : 'manual');
    setUserKeyword('');
    setUserResults([]);
    setSelectedUser(
      item.target_user_id
        ? {
            id: item.target_user_id,
            username: item.target_username,
            ips: [{ ip: item.rule, last_seen_at: item.updated_at }],
          }
        : null,
    );
    setSelectedIp(item.rule || '');
    setVisible(true);
  };

  const searchUsers = async (keyword = userKeyword) => {
    const normalizedKeyword = keyword.trim();
    setUserSearchLoading(true);
    try {
      const response = await API.get('/api/ip-bans/users', {
        params: { keyword: normalizedKeyword, p: 1, page_size: 50 },
      });
      if (!response.data.success) {
        showError(response.data.message);
        return;
      }
      setUserResults(response.data.data?.items || []);
    } catch (error) {
      showError(error.message);
    } finally {
      setUserSearchLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formApi) return;
    const values = formApi.getValues();
    const rule =
      createMode === 'user'
        ? editing
          ? editing.rule
          : selectedIp
        : values.rule?.trim();
    if (!rule) {
      showError(t('请输入 IP 地址或 CIDR 网段'));
      return;
    }
    let expiresAt = 0;
    if (!permanent) {
      const date = values.expires_at;
      expiresAt = date ? Math.floor(new Date(date).getTime() / 1000) : 0;
      if (!expiresAt || expiresAt <= Math.floor(Date.now() / 1000)) {
        showError(t('请选择未来的到期时间'));
        return;
      }
    }
    const payload = {
      rule,
      reason: values.reason?.trim() || '',
      enabled: values.enabled !== false,
      expires_at: expiresAt,
    };
    if (editing?.target_user_id)
      payload.target_user_id = editing.target_user_id;
    if (!editing && createMode === 'user') {
      if (!selectedUser || !selectedIp) {
        showError(t('请选择用户和登录 IP'));
        return;
      }
      payload.target_user_id = selectedUser.id;
    }
    setSaving(true);
    try {
      const response = editing
        ? await API.put(`/api/ip-bans/${editing.id}`, payload)
        : await API.post('/api/ip-bans', payload);
      if (!response.data.success) {
        showError(response.data.message);
        return;
      }
      showSuccess(t('保存成功'));
      setVisible(false);
      loadItems();
    } catch (error) {
      showError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item) => {
    try {
      const response = await API.post(`/api/ip-bans/${item.id}/toggle`);
      if (!response.data.success) {
        showError(response.data.message);
        return;
      }
      showSuccess(item.enabled ? t('已停用') : t('已启用'));
      loadItems();
    } catch (error) {
      showError(error.message);
    }
  };

  const handleDelete = (item) => {
    Modal.confirm({
      title: t('确认删除'),
      content: t('删除后该 IP 或网段将立即恢复访问，确认删除此封禁规则？'),
      okType: 'danger',
      onOk: async () => {
        const response = await API.delete(`/api/ip-bans/${item.id}`);
        if (!response.data.success) {
          showError(response.data.message);
          return;
        }
        showSuccess(t('删除成功'));
        if (items.length === 1 && page > 1) setPage(page - 1);
        else loadItems();
      },
    });
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    {
      title: t('IP 地址 / CIDR'),
      dataIndex: 'rule',
      render: (value) => <Text code>{value}</Text>,
    },
    {
      title: t('用户'),
      width: 190,
      render: (_, item) => {
        const userName = item.target_username;
        if (!item.target_user_id) return '-';
        return `${userName || '-'} (#${item.target_user_id})`;
      },
    },
    {
      title: t('封禁原因'),
      dataIndex: 'reason',
      render: (value) => value || '-',
    },
    {
      title: t('状态'),
      width: 100,
      render: (_, item) => {
        const expired =
          item.expires_at > 0 && item.expires_at <= Date.now() / 1000;
        if (expired) return <Tag color='grey'>{t('已过期')}</Tag>;
        return (
          <Tag color={item.enabled ? 'red' : 'grey'}>
            {item.enabled ? t('封禁中') : t('已停用')}
          </Tag>
        );
      },
    },
    {
      title: t('到期时间'),
      dataIndex: 'expires_at',
      width: 180,
      render: (value) => (value ? timestamp2string(value) : t('永久')),
    },
    {
      title: t('操作'),
      width: 235,
      render: (_, item) => (
        <Space wrap>
          <Button
            icon={<IconEdit />}
            size='small'
            onClick={() => openEdit(item)}
          >
            {t('编辑')}
          </Button>
          <Button size='small' onClick={() => handleToggle(item)}>
            {item.enabled ? t('停用') : t('启用')}
          </Button>
          <Button
            icon={<IconDelete />}
            size='small'
            type='danger'
            onClick={() => handleDelete(item)}
          >
            {t('删除')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className='mt-[60px] px-2'>
      <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
        <div>
          <Title heading={4}>{t('IP封禁')}</Title>
          <Text type='tertiary'>{t('管理禁止访问的 IP 和网段')}</Text>
        </div>
        <Space wrap>
          <Input
            prefix={<IconSearch />}
            value={search}
            placeholder={t('搜索 IP 或原因')}
            onChange={setSearch}
            onEnterPress={() => {
              setPage(1);
              setQuery(search.trim());
            }}
            showClear
          />
          <Button
            icon={<IconSearch />}
            onClick={() => {
              setPage(1);
              setQuery(search.trim());
            }}
          >
            {t('搜索')}
          </Button>
          <Button
            icon={<IconRefresh />}
            onClick={loadItems}
            loading={loading}
          />
          <Button type='primary' icon={<IconPlus />} onClick={openCreate}>
            {t('新增封禁')}
          </Button>
        </Space>
      </div>

      <div className='mt-4 overflow-x-auto'>
        <Table
          columns={columns}
          dataSource={items}
          rowKey='id'
          loading={loading}
          pagination={false}
          empty={<Text type='tertiary'>{t('暂无封禁规则')}</Text>}
        />
      </div>
      {total > PAGE_SIZE && (
        <div className='mt-4 flex justify-end'>
          <Pagination
            currentPage={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        </div>
      )}

      <Modal
        title={editing ? t('编辑 IP 封禁') : t('新增 IP 封禁')}
        visible={visible}
        onCancel={() => setVisible(false)}
        onOk={handleSave}
        confirmLoading={saving}
        closeOnEsc={!saving}
        maskClosable={false}
        width={560}
      >
        <Form
          getFormApi={setFormApi}
          initValues={{
            rule: editing?.rule || '',
            reason: editing?.reason || '',
            enabled: editing?.enabled ?? true,
            expires_at: editing?.expires_at
              ? new Date(editing.expires_at * 1000)
              : null,
          }}
        >
          {!editing && (
            <RadioGroup
              type='button'
              value={createMode}
              onChange={(event) => {
                const mode = event.target.value;
                setCreateMode(mode);
                if (mode === 'user') setSelectedIp('');
              }}
              className='mb-3'
            >
              <Radio value='user'>{t('注册用户')}</Radio>
              <Radio value='manual'>{t('手动输入 IP / CIDR')}</Radio>
            </RadioGroup>
          )}
          {editing?.target_user_id ? (
            <div className='mb-3 rounded border p-2 text-sm'>
              <Text type='tertiary'>{t('关联用户')}</Text>{' '}
              {selectedUser?.username ||
                selectedUser?.display_name ||
                `#${editing.target_user_id}`}{' '}
              · <Text code>{editing.rule}</Text>
            </div>
          ) : createMode === 'user' ? (
            <div className='mb-3'>
              <Text strong>{t('选择注册用户')}</Text>
              <div className='mt-1 flex gap-2'>
                <Input
                  value={userKeyword}
                  placeholder={t('搜索用户名、邮箱或用户 ID')}
                  onChange={setUserKeyword}
                  onEnterPress={() => searchUsers()}
                  showClear
                />
                <Button
                  loading={userSearchLoading}
                  onClick={() => searchUsers()}
                >
                  {t('搜索')}
                </Button>
              </div>
              <div className='mt-2 max-h-40 overflow-y-auto'>
                {userResults.map((user) => (
                  <div
                    key={user.id}
                    className={`mb-1 cursor-pointer rounded border p-2 text-sm ${selectedUser?.id === user.id ? 'border-blue-500 bg-blue-50' : ''}`}
                    onClick={() => {
                      if (selectedUser?.id !== user.id) {
                        setSelectedUser(user);
                        setSelectedIp('');
                      }
                    }}
                  >
                    <div>
                      #{user.id} · {user.username || '-'} ·{' '}
                      {user.display_name || '-'} · {user.email || '-'}
                    </div>
                    {(user.ips || []).length > 0 ? (
                      <div className='mt-1 flex flex-wrap items-center gap-1'>
                        <Text type='tertiary' size='small'>
                          {t('登录 IP')} ({user.ips.length}):
                        </Text>
                        {user.ips.map((ip) => (
                          <Tag key={ip.ip} color='blue' size='small'>
                            {ip.ip}
                          </Tag>
                        ))}
                      </div>
                    ) : (
                      <Text type='tertiary' size='small'>
                        {t('该用户暂无可用登录 IP')}
                      </Text>
                    )}
                    {selectedUser?.id === user.id &&
                      (user.ips || []).length > 0 && (
                        <div className='mt-2 border-t pt-2'>
                          <Text strong size='small'>
                            {t('选择要封禁的 IP')}
                          </Text>
                          <RadioGroup
                            value={selectedIp}
                            onChange={(event) =>
                              setSelectedIp(event.target.value)
                            }
                            className='mt-1'
                          >
                            {(user.ips || []).map((ip) => (
                              <Radio key={ip.ip} value={ip.ip}>
                                {ip.ip}{' '}
                                {ip.last_seen_at
                                  ? `(${timestamp2string(ip.last_seen_at)})`
                                  : ''}
                              </Radio>
                            ))}
                          </RadioGroup>
                        </div>
                      )}
                  </div>
                ))}
              </div>
              {selectedUser && selectedIp && (
                <div className='mt-2 rounded border border-red-200 bg-red-50 p-2'>
                  <Text strong>{t('将封禁 IP')}: </Text>
                  <Text code>{selectedIp}</Text>
                </div>
              )}
            </div>
          ) : (
            <Form.Input
              field='rule'
              label={t('IP 地址 / CIDR')}
              placeholder='203.0.113.10 / 2001:db8::/32'
            />
          )}
          <Form.TextArea
            field='reason'
            label={t('封禁原因')}
            maxCount={1000}
            autosize={{ minRows: 3, maxRows: 6 }}
          />
          <Form.Switch field='enabled' label={t('立即启用')} />
          <div className='mb-3 flex items-center gap-2'>
            <Text>{t('永久封禁')}</Text>
            <Switch checked={permanent} onChange={setPermanent} />
          </div>
          {!permanent && (
            <Form.DatePicker
              field='expires_at'
              type='dateTime'
              style={{ width: '100%' }}
              placeholder={t('选择到期时间')}
              showClear
            />
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default IpBan;
