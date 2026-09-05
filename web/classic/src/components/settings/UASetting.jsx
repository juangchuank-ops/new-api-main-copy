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

import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, Form, Select, Spin, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';

import {
  API,
  compareObjects,
  showError,
  showSuccess,
  showWarning,
  toBoolean,
} from '../../helpers';

const { Text } = Typography;

const UA_OPTION_KEYS = [
  'RelayUserAgentBlacklistEnabled',
  'RelayUserAgentBlacklist',
  'RelayUserAgentBlacklistAction',
];

const UASetting = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    RelayUserAgentBlacklistEnabled: false,
    RelayUserAgentBlacklist: '',
    RelayUserAgentBlacklistAction: '403',
  });
  const [inputsRow, setInputsRow] = useState(inputs);
  const refForm = useRef();

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      const newInputs = {};
      data.forEach((item) => {
        if (!UA_OPTION_KEYS.includes(item.key)) return;
        newInputs[item.key] = item.key.endsWith('Enabled')
          ? toBoolean(item.value)
          : item.value;
      });
      setInputs(newInputs);
      setInputsRow(structuredClone(newInputs));
      refForm.current?.setValues(newInputs);
    } else {
      showError(message);
    }
  };

  useEffect(() => {
    getOptions();
  }, []);

  const onSubmit = async () => {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    if (
      inputs.RelayUserAgentBlacklistEnabled &&
      !inputs.RelayUserAgentBlacklist.trim()
    ) {
      return showWarning(t('黑名单为空，请先填写 UA 黑名单'));
    }
    setLoading(true);
    const requestQueue = updateArray.map((item) =>
      API.put('/api/option/', {
        key: item.key,
        value:
          typeof inputs[item.key] === 'boolean'
            ? String(inputs[item.key])
            : inputs[item.key],
      }),
    );
    try {
      const res = await Promise.all(requestQueue);
      for (let i = 0; i < res.length; i++) {
        if (!res[i].data.success) {
          return showError(res[i].data.message);
        }
      }
      showSuccess(t('保存成功'));
      await getOptions();
    } catch (error) {
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Spin spinning={loading} size='large'>
      <Card style={{ marginTop: '10px' }} title={t('UA 黑名单')}>
        <Text type='secondary' size='small'>
          {t('每行一条。普通文本按子串匹配(不区分大小写)，含正则元字符时按正则匹配。')}
        </Text>
        <Form
          values={inputs}
          getFormApi={(formAPI) => (refForm.current = formAPI)}
          onSubmit={onSubmit}
          style={{ marginTop: 12 }}
        >
          <Form.Switch
            field='RelayUserAgentBlacklistEnabled'
            label={t('启用 UA 黑名单')}
            extraText={t('开启后，命中黑名单的客户端将无法调用 API')}
            size='default'
            onChange={(value) =>
              setInputs({ ...inputs, RelayUserAgentBlacklistEnabled: value })
            }
          />
          <Form.TextArea
            field='RelayUserAgentBlacklist'
            label={t('黑名单内容')}
            placeholder={'Go-http-client/2.0'}
            rows={6}
            style={{ marginTop: 12 }}
            onChange={(value) =>
              setInputs({ ...inputs, RelayUserAgentBlacklist: value })
            }
          />
        </Form>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginTop: 12,
          }}
        >
          <Text style={{ flexShrink: 0 }}>{t('命中后的动作')}</Text>
          <Select
            style={{ width: 280 }}
            value={inputs.RelayUserAgentBlacklistAction}
            optionList={[
              { value: '403', label: t('仅拒绝请求(403)') },
              { value: 'ban', label: t('封禁账号') },
              { value: 'reject_ban', label: t('拒绝请求并封禁账号') },
              { value: 'reject_ban_ip', label: t('封禁账号并封锁全部IP') },
            ]}
            onChange={(value) =>
              setInputs({ ...inputs, RelayUserAgentBlacklistAction: value })
            }
          />
        </div>
        <Text type='secondary' size='small' style={{ display: 'block', marginTop: 8 }}>
          {t('命中黑名单的请求将按所选动作处理，账号封禁为永久，封锁IP不设期限')}
        </Text>
        <Button
          type='primary'
          loading={loading}
          onClick={onSubmit}
          style={{ marginTop: 16 }}
        >
          {t('保存 UA 限制设置')}
        </Button>
      </Card>
    </Spin>
  );
};

export default UASetting;
