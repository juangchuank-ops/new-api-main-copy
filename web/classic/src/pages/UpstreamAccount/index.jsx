import React, { useEffect, useState, useCallback } from 'react';
import {
  Button,
  Card,
  Table,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Switch,
  InputNumber,
  Typography,
  Spin,
  Empty,
  Toast,
} from '@douyinfe/semi-ui';
import {
  IconPlus,
  IconDelete,
  IconRefresh,
  IconChevronRight,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess, timestamp2string } from '../../helpers';

const { Text } = Typography;

const UpstreamAccount = () => {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [logsVisible, setLogsVisible] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formApi, setFormApi] = useState(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/upstream-account/');
      if (res.data.success) {
        setAccounts(res.data.data || []);
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const loadLogs = useCallback(async (accountId) => {
    setLogsLoading(true);
    try {
      const url = accountId
        ? `/api/upstream-account/logs?account_id=${accountId}&limit=100`
        : '/api/upstream-account/logs?limit=100';
      const res = await API.get(url);
      if (res.data.success) {
        setLogs(res.data.data || []);
      }
    } catch (e) {
      showError(e.message);
    }
    setLogsLoading(false);
  }, []);

  const handleSave = async () => {
    if (!formApi) return;
    const values = formApi.getValues();
    if (!values.name || !values.base_url) {
      showError(t('名称和地址不能为空'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: values.name,
        base_url: values.base_url,
        auth_type: values.auth_type || 'token',
        user_id: Number(values.user_id) || 0,
        auto_checkin: values.auto_checkin || false,
        auto_balance: values.auto_balance !== false,
        balance_interval: Number(values.balance_interval) || 60,
        credential: values.credential || '',
      };
      let res;
      if (editingAccount) {
        res = await API.put(`/api/upstream-account/${editingAccount.id}`, payload);
      } else {
        res = await API.post('/api/upstream-account/', payload);
      }
      if (res.data.success) {
        showSuccess(t('保存成功'));
        setEditVisible(false);
        loadAccounts();
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e.message);
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    Modal.confirm({
      title: t('确认删除'),
      content: t('删除后不可恢复，确认删除此上游账号？'),
      onOk: async () => {
        try {
          const res = await API.delete(`/api/upstream-account/${id}`);
          if (res.data.success) {
            showSuccess(t('删除成功'));
            loadAccounts();
          } else {
            showError(res.data.message);
          }
        } catch (e) {
          showError(e.message);
        }
      },
    });
  };

  const runOperation = async (id, op, label) => {
    try {
      const res = await API.post(`/api/upstream-account/${id}/${op}`);
      if (res.data.success) {
        showSuccess(`${label}：${res.data.data?.message || t('成功')}`);
        loadAccounts();
      } else {
        showError(res.data.message || t('操作失败'));
      }
    } catch (e) {
      showError(e.message);
    }
  };

  const renderStatus = (status) => {
    const map = {
      healthy: { color: 'green', text: t('正常') },
      failed: { color: 'red', text: t('失败') },
      unknown: { color: 'grey', text: t('未知') },
      manual_required: { color: 'orange', text: t('需手动') },
    };
    const item = map[status] || map.unknown;
    return <Tag color={item.color} shape='circle'>{item.text}</Tag>;
  };

  const renderBalance = (account) => {
    if (!account.balance_updated_time) return '-';
    const unit = account.balance_unit || 'USD';
    const symbol = unit === 'USD' ? '$' : '';
    return `${symbol}${account.balance.toFixed(4)} ${unit}`;
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: t('名称'),
      dataIndex: 'name',
      render: (text, record) => (
        <Button theme='borderless' type='tertiary' onClick={() => { setEditingAccount(record); setEditVisible(true); }}>
          {text}
        </Button>
      ),
    },
    {
      title: t('地址'),
      dataIndex: 'base_url',
      ellipsis: true,
    },
    {
      title: t('认证方式'),
      dataIndex: 'auth_type',
      width: 100,
      render: (v) => v === 'cookie' ? 'Cookie' : 'Token',
    },
    {
      title: t('余额'),
      render: (_, r) => renderBalance(r),
    },
    {
      title: t('余额状态'),
      dataIndex: 'balance_status',
      width: 90,
      render: renderStatus,
    },
    {
      title: t('签到状态'),
      dataIndex: 'last_checkin_status',
      width: 90,
      render: renderStatus,
    },
    {
      title: t('自动签到'),
      dataIndex: 'auto_checkin',
      width: 90,
      render: (v) => <Tag color={v ? 'green' : 'grey'} shape='circle'>{v ? t('开') : t('关')}</Tag>,
    },
    {
      title: t('上次签到'),
      dataIndex: 'last_checkin_time',
      width: 160,
      render: (v) => v ? timestamp2string(v) : '-',
    },
    {
      title: t('操作'),
      width: 320,
      render: (_, record) => (
        <Space>
          <Button size='small' type='primary' theme='solid' onClick={() => runOperation(record.id, 'checkin', t('签到'))}>
            {t('签到')}
          </Button>
          <Button size='small' onClick={() => runOperation(record.id, 'balance', t('余额'))}>
            {t('余额')}
          </Button>
          <Button size='small' onClick={() => runOperation(record.id, 'health', t('健康'))}>
            {t('健康')}
          </Button>
          <Button size='small' type='tertiary' onClick={() => { setEditingAccount(record); setEditVisible(true); }}>
            {t('编辑')}
          </Button>
          <Button size='small' type='danger' icon={<IconDelete />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  const logColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: t('类型'),
      dataIndex: 'type',
      width: 80,
      render: (v) => {
        const map = { checkin: t('签到'), balance: t('余额'), health: t('健康') };
        return map[v] || v;
      },
    },
    {
      title: t('触发'),
      dataIndex: 'trigger',
      width: 80,
      render: (v) => v === 'manual' ? t('手动') : t('定时'),
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 80,
      render: renderStatus,
    },
    { title: t('消息'), dataIndex: 'message', ellipsis: true },
    {
      title: t('奖励'),
      dataIndex: 'reward',
      width: 80,
      render: (v) => v ? v.toFixed(2) : '-',
    },
    {
      title: t('时间'),
      dataIndex: 'created_at',
      width: 160,
      render: (v) => timestamp2string(v),
    },
  ];

  return (
    <div className='mt-[60px] px-2'>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button
            icon={<IconPlus />}
            type='primary'
            theme='solid'
            onClick={() => { setEditingAccount(null); setEditVisible(true); }}
          >
            {t('添加上游账号')}
          </Button>
          <Button
            icon={<IconRefresh />}
            onClick={loadAccounts}
          >
            {t('刷新')}
          </Button>
          <Button
            icon={<IconChevronRight />}
            onClick={() => { setLogsVisible(true); loadLogs(null); }}
          >
            {t('操作日志')}
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={accounts}
          rowKey='id'
          pagination={{ pageSize: 20, showSizeChanger: true }}
          loading={loading}
          scroll={{ x: 'max-content' }}
          empty={
            <Empty
              description={t('暂无上游账号，点击上方"添加上游账号"开始')}
              style={{ padding: 30 }}
            />
          }
        />
      </Card>

      <Modal
        title={editingAccount ? t('编辑上游账号') : t('添加上游账号')}
        visible={editVisible}
        onCancel={() => setEditVisible(false)}
        onOk={handleSave}
        confirmLoading={saving}
        width={560}
      >
        <Form
          getFormApi={setFormApi}
          initValues={editingAccount ? {
            name: editingAccount.name,
            base_url: editingAccount.base_url,
            auth_type: editingAccount.auth_type,
            user_id: editingAccount.user_id,
            auto_checkin: editingAccount.auto_checkin,
            auto_balance: editingAccount.auto_balance,
            balance_interval: editingAccount.balance_interval,
            credential: '',
          } : {
            auth_type: 'token',
            auto_balance: true,
            balance_interval: 60,
          }}
        >
          <Form.Input field='name' label={t('名称')} placeholder={t('例如：站点A')} rules={[{ required: true, message: t('必填') }]} />
          <Form.Input field='base_url' label={t('站点地址')} placeholder='https://api.example.com' rules={[{ required: true, message: t('必填') }]} />
          <Form.Select field='auth_type' label={t('认证方式')} optionList={[
            { value: 'token', label: 'Token (Bearer)' },
            { value: 'cookie', label: 'Cookie' },
          ]} />
          <Form.InputNumber field='user_id' label={t('用户 ID（Token 认证时可选）')} placeholder='0' min={0} />
          <Form.Input field='credential' label={t('凭证')} placeholder={editingAccount?.credential_configured ? t('已配置，留空不修改') : t('Token 或 Cookie')} />
          <Form.Switch field='auto_checkin' label={t('自动签到')} />
          <Form.Switch field='auto_balance' label={t('自动刷新余额')} />
          <Form.InputNumber field='balance_interval' label={t('余额刷新间隔（分钟）')} min={5} placeholder='60' />
        </Form>
      </Modal>

      <Modal
        title={t('操作日志')}
        visible={logsVisible}
        onCancel={() => setLogsVisible(false)}
        footer={null}
        width={900}
      >
        <Spin spinning={logsLoading}>
          <Table
            columns={logColumns}
            dataSource={logs}
            rowKey='id'
            pagination={{ pageSize: 20 }}
            scroll={{ x: 'max-content' }}
            size='small'
            empty={<Empty description={t('暂无日志')} style={{ padding: 20 }} />}
          />
        </Spin>
      </Modal>
    </div>
  );
};

export default UpstreamAccount;
