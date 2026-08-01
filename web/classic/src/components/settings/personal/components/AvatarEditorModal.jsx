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
import {
  Avatar,
  Button,
  Input,
  Modal,
  Radio,
  RadioGroup,
  Space,
  Typography,
} from '@douyinfe/semi-ui';
import { ImagePlus, Link2, Save, Trash2, Upload } from 'lucide-react';
import {
  API,
  compressAvatarFile,
  isAvatarDataUrl,
  isExternalAvatarUrl,
  showError,
  showSuccess,
} from '../../../../helpers';

const AvatarEditorModal = ({
  visible,
  onCancel,
  currentAvatar,
  username,
  onSaved,
  t,
}) => {
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState('upload');
  const [uploadedAvatar, setUploadedAvatar] = useState('');
  const [linkValue, setLinkValue] = useState('');
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const currentIsDataUrl = isAvatarDataUrl(currentAvatar);
    setMode(currentAvatar && !currentIsDataUrl ? 'link' : 'upload');
    setUploadedAvatar(currentIsDataUrl ? currentAvatar : '');
    setLinkValue(currentAvatar && !currentIsDataUrl ? currentAvatar : '');
  }, [currentAvatar, visible]);

  const fallback = (username || 'NA').slice(0, 2).toUpperCase();
  const trimmedLink = linkValue.trim();
  const validLink = isExternalAvatarUrl(trimmedLink);
  const previewAvatar =
    mode === 'upload'
      ? uploadedAvatar || currentAvatar
      : validLink
        ? trimmedLink
        : currentAvatar;

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setProcessing(true);
    try {
      const dataUrl = await compressAvatarFile(file);
      setUploadedAvatar(dataUrl);
    } catch (error) {
      if (error?.message === 'file_too_large') {
        showError(t('图片文件不能超过 5 MB'));
      } else if (error?.message === 'unsupported_type') {
        showError(t('仅支持 JPG、PNG 或 WebP 图片'));
      } else {
        showError(t('头像处理失败，请更换图片后重试'));
      }
    } finally {
      setProcessing(false);
    }
  };

  const saveAvatar = async (avatarUrl) => {
    setSaving(true);
    try {
      const response = await API.put('/api/user/self', {
        avatar_url: avatarUrl,
      });
      const { success, message } = response.data;
      if (!success) {
        showError(message || t('头像更新失败'));
        return;
      }
      onSaved(avatarUrl);
      showSuccess(t('头像更新成功'));
      onCancel();
    } catch {
      showError(t('头像更新失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (mode === 'link' && !validLink) {
      showError(t('仅支持 HTTP 或 HTTPS 图片链接'));
      return;
    }
    if (mode === 'upload' && !uploadedAvatar && !currentAvatar) {
      showError(t('请选择头像图片'));
      return;
    }
    void saveAvatar(
      mode === 'upload' ? uploadedAvatar || currentAvatar : trimmedLink,
    );
  };

  return (
    <Modal
      title={t('编辑头像')}
      visible={visible}
      onCancel={onCancel}
      width={520}
      footer={
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <Button
            type='danger'
            theme='borderless'
            icon={<Trash2 size={16} />}
            disabled={!currentAvatar || saving || processing}
            onClick={() => void saveAvatar('')}
          >
            {t('移除头像')}
          </Button>
          <Space>
            <Button onClick={onCancel} disabled={saving}>
              {t('取消')}
            </Button>
            <Button
              type='primary'
              theme='solid'
              icon={<Save size={16} />}
              loading={saving}
              disabled={processing}
              onClick={handleSave}
            >
              {t('保存头像')}
            </Button>
          </Space>
        </div>
      }
    >
      <div className='flex flex-col gap-5'>
        <div className='flex items-center gap-4 border p-4'>
          <Avatar
            size='extra-large'
            src={previewAvatar || undefined}
            alt={t('头像预览')}
          >
            {fallback}
          </Avatar>
          <div className='min-w-0'>
            <Typography.Text strong>{t('头像预览')}</Typography.Text>
            <div className='truncate text-sm text-semi-color-text-2'>
              {username}
            </div>
          </div>
        </div>

        <RadioGroup
          type='button'
          value={mode}
          onChange={(event) => setMode(event.target.value)}
        >
          <Radio value='upload'>
            <span className='inline-flex items-center gap-1.5'>
              <Upload size={14} />
              {t('上传图片')}
            </span>
          </Radio>
          <Radio value='link'>
            <span className='inline-flex items-center gap-1.5'>
              <Link2 size={14} />
              {t('图片链接')}
            </span>
          </Radio>
        </RadioGroup>

        {mode === 'upload' ? (
          <div>
            <input
              ref={fileInputRef}
              type='file'
              accept='image/jpeg,image/png,image/webp'
              className='hidden'
              onChange={(event) => void handleFileChange(event)}
            />
            <Button
              icon={<ImagePlus size={16} />}
              loading={processing}
              onClick={() => fileInputRef.current?.click()}
            >
              {t('选择头像图片')}
            </Button>
          </div>
        ) : (
          <Input
            value={linkValue}
            prefix={<Link2 size={16} />}
            placeholder={t('请输入头像图片链接')}
            onChange={setLinkValue}
            onEnterPress={handleSave}
          />
        )}
      </div>
    </Modal>
  );
};

export default AvatarEditorModal;
