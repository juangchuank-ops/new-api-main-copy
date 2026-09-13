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

import React, { useEffect, useState } from 'react';
import {
  Banner,
  Button,
  Input,
  Modal,
  Space,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { IconUpload } from '@douyinfe/semi-icons';
import { useIsMobile } from '../../../hooks/common/useIsMobile';

const { Text } = Typography;

const MAX_SOURCE_BYTES = 1024 * 1024;
const MAX_ICON_DATAURI_BYTES = 512 * 1024;

const TaskPluginUploadModal = ({
  uploadVisible,
  uploadTargetKey,
  closeUpload,
  uploadPlugin,
  t,
}) => {
  const isMobile = useIsMobile();

  const [source, setSource] = useState('');
  const [fileName, setFileName] = useState('');
  const [remark, setRemark] = useState('');
  const [icon, setIcon] = useState('');
  const [iconFileName, setIconFileName] = useState('');
  const [iconError, setIconError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [uploading, setUploading] = useState(false);

  const resetState = () => {
    setSource('');
    setFileName('');
    setRemark('');
    setIcon('');
    setIconFileName('');
    setIconError('');
    setErrorMessage('');
    setUploading(false);
  };

  useEffect(() => {
    if (!uploadVisible) {
      resetState();
    }
  }, [uploadVisible]);

  const handleClose = () => {
    closeUpload();
    resetState();
  };

  const handleSourceFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_SOURCE_BYTES) {
      setErrorMessage(t('插件源码不能超过 1 MiB。'));
      return;
    }
    setErrorMessage('');
    try {
      const text = await file.text();
      setSource(text);
      setFileName(file.name);
    } catch (error) {
      setErrorMessage(t('读取源码文件失败，请重试。'));
    }
  };

  const handleIconFile = (file) => {
    if (!file) return;
    const isSvg = /\.svg$/i.test(file.name) || file.type === 'image/svg+xml';
    const isPng = /\.png$/i.test(file.name) || file.type === 'image/png';
    if (!isSvg && !isPng) {
      setIcon('');
      setIconFileName('');
      setIconError(t('插件图标必须是 .svg 或 .png 文件。'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',')
        ? result.slice(result.indexOf(',') + 1)
        : '';
      const mediaType = isSvg ? 'image/svg+xml' : 'image/png';
      const dataUri = `data:${mediaType};base64,${base64}`;
      if (dataUri.length > MAX_ICON_DATAURI_BYTES) {
        setIcon('');
        setIconFileName('');
        setIconError(t('插件图标超过 512 KiB 限制。'));
        return;
      }
      setIcon(dataUri);
      setIconFileName(file.name);
      setIconError('');
    };
    reader.onerror = () => {
      setIconError(t('读取图标文件失败，请重试。'));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!source.trim() || uploading) return;
    setUploading(true);
    setErrorMessage('');
    const outcome = await uploadPlugin({ source, remark, icon });
    setUploading(false);
    if (outcome?.success) {
      handleClose();
    } else if (outcome?.message) {
      setErrorMessage(outcome.message);
    }
  };

  return (
    <Modal
      title={uploadTargetKey ? t('上传插件新版本') : t('上传任务插件')}
      visible={uploadVisible}
      onCancel={handleClose}
      onOk={handleSubmit}
      okText={uploading ? t('上传中...') : t('上传')}
      cancelText={t('取消')}
      confirmLoading={uploading}
      okButtonProps={{ disabled: !source.trim() }}
      maskClosable={false}
      width={isMobile ? '100%' : 720}
    >
      <Space vertical align='start' style={{ width: '100%' }} spacing={12}>
        <Banner
          type='warning'
          closeIcon={null}
          description={t(
            '上传插件属于管理员级别的信任决策。插件可以访问渠道凭据并改写上游请求，激活前请先审阅其源码。',
          )}
        />
        {uploadTargetKey ? (
          <Text type='tertiary'>
            {t('插件 Key')}: {uploadTargetKey}
          </Text>
        ) : null}

        <div className='w-full'>
          <div className='mb-2 flex items-center justify-between'>
            <Text strong>{t('插件源码')}</Text>
            <span style={{ color: 'var(--semi-color-text-2)', fontSize: 12 }}>
              {fileName || t('支持选择 .js 文件或直接粘贴源码')}
            </span>
          </div>
          <input
            type='file'
            accept='.js,text/javascript,application/javascript'
            className='block w-full text-sm'
            onChange={(e) => {
              handleSourceFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <TextArea
            className='!mt-2'
            rows={14}
            value={source}
            placeholder={t('在此粘贴 JavaScript 插件源码...')}
            onChange={(value) => {
              setSource(value);
              setErrorMessage('');
            }}
          />
        </div>

        <div className='w-full'>
          <div className='mb-2 flex items-center gap-3'>
            <Text strong>{t('插件图标')}</Text>
            {icon ? (
              <>
                <span
                  className='inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md'
                  style={{
                    width: 24,
                    height: 24,
                    backgroundColor: 'var(--semi-color-fill-0)',
                  }}
                >
                  <img
                    src={icon}
                    alt=''
                    width={24}
                    height={24}
                    className='h-full w-full object-contain'
                  />
                </span>
                <Button
                  size='small'
                  theme='borderless'
                  type='danger'
                  onClick={() => {
                    setIcon('');
                    setIconFileName('');
                    setIconError('');
                  }}
                >
                  {t('移除')}
                </Button>
              </>
            ) : null}
          </div>
          <input
            type='file'
            accept='.svg,.png,image/svg+xml,image/png'
            className='block w-full text-sm'
            onChange={(e) => {
              handleIconFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <div
            className='mt-1'
            style={{ color: 'var(--semi-color-text-2)', fontSize: 12 }}
          >
            {iconFileName ||
              t(
                '可选，随插件一起的 icon.svg 或 icon.png，最大 512 KiB，与源码分开存储。',
              )}
          </div>
          {iconError ? (
            <div style={{ color: 'var(--semi-color-danger)', fontSize: 12 }}>
              {iconError}
            </div>
          ) : null}
        </div>

        <div className='w-full'>
          <Text strong>{t('备注')}</Text>
          <Input
            className='!mt-2'
            value={remark}
            placeholder={t('可选，描述该版本的信息')}
            onChange={setRemark}
          />
        </div>

        {errorMessage ? (
          <Banner
            type='danger'
            closeIcon={null}
            description={errorMessage}
            className='whitespace-pre-wrap w-full'
          />
        ) : null}

        <Text type='tertiary' size='small'>
          <IconUpload /> {t('插件源码大小上限 1 MiB。')}
        </Text>
      </Space>
    </Modal>
  );
};

export default TaskPluginUploadModal;
