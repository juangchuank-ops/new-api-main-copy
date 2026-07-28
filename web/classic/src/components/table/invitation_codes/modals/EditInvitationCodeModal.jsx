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

import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  API,
  showError,
  showSuccess,
} from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import {
  Button,
  Modal,
  SideSheet,
  Space,
  Spin,
  Typography,
  Card,
  Tag,
  Form,
  Avatar,
  Row,
  Col,
  InputNumber,
} from '@douyinfe/semi-ui';
import {
  IconSave,
  IconClose,
  IconGift,
} from '@douyinfe/semi-icons';

const { Text, Title } = Typography;

const EditInvitationCodeModal = (props) => {
  const { t } = useTranslation();
  const isEdit = props.editingInvitationCode.id !== undefined;
  const [loading, setLoading] = useState(isEdit);
  const isMobile = useIsMobile();
  const formApiRef = useRef(null);

  const getInitValues = () => ({
    name: '',
    count: 1,
  });

  const handleCancel = () => {
    props.handleClose();
  };

  const loadInvitationCode = async () => {
    setLoading(true);
    let res = await API.get(`/api/invitation-code/${props.editingInvitationCode.id}`);
    const { success, message, data } = res.data;
    if (success) {
      formApiRef.current?.setValues({ ...getInitValues(), ...data });
    } else {
      showError(message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (formApiRef.current) {
      if (isEdit) {
        loadInvitationCode();
      } else {
        formApiRef.current.setValues(getInitValues());
      }
    }
  }, [props.editingInvitationCode.id]);

  const submit = async (values) => {
    let name = values.name;
    if (!name || name === '') {
      showError(t('请输入名称'));
      return;
    }
    if (name.length > 20) {
      showError(t('名称长度不能超过20个字符'));
      return;
    }
    setLoading(true);
    let localInputs = { ...values };
    localInputs.name = name;

    let res;
    if (isEdit) {
      res = await API.put(`/api/invitation-code/`, {
        ...localInputs,
        id: parseInt(props.editingInvitationCode.id),
      });
    } else {
      localInputs.count = parseInt(localInputs.count) || 1;
      if (localInputs.count < 1 || localInputs.count > 1000) {
        showError(t('生成数量必须在1-1000之间'));
        setLoading(false);
        return;
      }
      res = await API.post(`/api/invitation-code/`, {
        ...localInputs,
      });
    }
    const { success, message, data } = res.data;
    if (success) {
      if (isEdit) {
        showSuccess(t('邀请码更新成功！'));
        props.refresh();
        props.handleClose();
      } else {
        showSuccess(t('邀请码创建成功！'));
        props.refresh();
        formApiRef.current?.setValues(getInitValues());
        props.handleClose();
      }
    } else {
      showError(message);
    }
    if (!isEdit && data) {
      let text = '';
      for (let i = 0; i < data.length; i++) {
        text += data[i] + '\n';
      }
      Modal.confirm({
        title: t('邀请码创建成功'),
        content: (
          <div>
            <p>{t('邀请码创建成功，是否下载邀请码？')}</p>
            <p>{t('邀请码将以文本文件的形式下载，文件名为邀请码的名称。')}</p>
          </div>
        ),
        onOk: () => {
          const downloadTextAsFile = (content, fileName) => {
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
          };
          downloadTextAsFile(text, `${localInputs.name}.txt`);
        },
      });
    }
    setLoading(false);
  };

  return (
    <>
      <SideSheet
        placement={isEdit ? 'right' : 'left'}
        title={
          <Space>
            {isEdit ? (
              <Tag color='blue' shape='circle'>
                {t('更新')}
              </Tag>
            ) : (
              <Tag color='green' shape='circle'>
                {t('新建')}
              </Tag>
            )}
            <Title heading={4} className='m-0'>
              {isEdit ? t('更新邀请码信息') : t('创建新的邀请码')}
            </Title>
          </Space>
        }
        bodyStyle={{ padding: '0' }}
        visible={props.visiable}
        width={isMobile ? '100%' : 600}
        footer={
          <div className='flex justify-end bg-white'>
            <Space>
              <Button
                theme='solid'
                onClick={() => formApiRef.current?.submitForm()}
                icon={<IconSave />}
                loading={loading}
              >
                {t('提交')}
              </Button>
              <Button
                theme='light'
                type='primary'
                onClick={handleCancel}
                icon={<IconClose />}
              >
                {t('取消')}
              </Button>
            </Space>
          </div>
        }
        closeIcon={null}
        onCancel={() => handleCancel()}
      >
        <Spin spinning={loading}>
          <Form
            initValues={getInitValues()}
            getFormApi={(api) => (formApiRef.current = api)}
            onSubmit={submit}
          >
            {({ values }) => (
              <div className='p-2'>
                <Card className='!rounded-2xl shadow-sm border-0 mb-6'>
                  {/* Header: Basic Info */}
                  <div className='flex items-center mb-2'>
                    <Avatar
                      size='small'
                      color='blue'
                      className='mr-2 shadow-md'
                    >
                      <IconGift size={16} />
                    </Avatar>
                    <div>
                      <Text className='text-lg font-medium'>
                        {t('基本信息')}
                      </Text>
                      <div className='text-xs text-gray-600'>
                        {t('设置邀请码的基本信息')}
                      </div>
                    </div>
                  </div>

                  <Row gutter={12}>
                    <Col span={24}>
                      <Form.Input
                        field='name'
                        label={t('名称')}
                        placeholder={t('请输入名称，1-20个字符')}
                        style={{ width: '100%' }}
                        rules={[
                          { required: true, message: t('请输入名称') },
                          {
                            validator: (rule, v) => {
                              if (v && v.length > 20) {
                                return Promise.reject(t('名称长度不能超过20个字符'));
                              }
                              return Promise.resolve();
                            },
                          },
                        ]}
                        showClear
                      />
                    </Col>
                    {!isEdit && (
                      <Col span={12}>
                        <Form.InputNumber
                          field='count'
                          label={t('生成数量')}
                          min={1}
                          max={1000}
                          rules={[
                            { required: true, message: t('请输入生成数量') },
                            {
                              validator: (rule, v) => {
                                const num = parseInt(v, 10);
                                if (num < 1 || num > 1000) {
                                  return Promise.reject(t('生成数量必须在1-1000之间'));
                                }
                                return Promise.resolve();
                              },
                            },
                          ]}
                          style={{ width: '100%' }}
                          showClear
                        />
                      </Col>
                    )}
                  </Row>
                </Card>
              </div>
            )}
          </Form>
        </Spin>
      </SideSheet>
    </>
  );
};

export default EditInvitationCodeModal;
