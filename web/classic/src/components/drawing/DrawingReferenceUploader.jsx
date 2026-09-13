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

import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Typography } from '@douyinfe/semi-ui';
import { ImagePlus, X, Eraser } from 'lucide-react';
import { showError } from '../../helpers';
import { MAX_REFERENCE_IMAGES, imageFileToAsset } from '../../helpers/drawing';

const { Text } = Typography;

const DrawingReferenceUploader = ({
  references = [],
  mask,
  onReferencesChange,
  onMaskChange,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const referenceInputRef = useRef(null);
  const maskInputRef = useRef(null);

  const handleReferenceFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;

    const remaining = MAX_REFERENCE_IMAGES - references.length;
    if (remaining <= 0) {
      showError(t('最多支持 16 张参考图。'));
      return;
    }

    try {
      const assets = await Promise.all(
        files.slice(0, remaining).map((file) => imageFileToAsset(file)),
      );
      onReferencesChange([...references, ...assets]);
    } catch (error) {
      showError(error.message || t('无法加载图片。'));
    }
  };

  const handleMaskFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const asset = await imageFileToAsset(file);
      if (asset.mimeType !== 'image/png') {
        showError(t('mask 必须是 PNG 格式。'));
        return;
      }
      if (references[0]) {
        if (
          asset.width !== references[0].width ||
          asset.height !== references[0].height
        ) {
          showError(t('mask 必须与首张参考图尺寸一致。'));
          return;
        }
      }
      onMaskChange(asset);
    } catch (error) {
      showError(error.message || t('无法加载图片。'));
    }
  };

  const removeReference = (id) => {
    const next = references.filter((item) => item.id !== id);
    onReferencesChange(next);
    if (mask && references[0]?.id === id) {
      onMaskChange(null);
    }
  };

  return (
    <div className='space-y-4'>
      <div>
        <div className='flex items-center justify-between mb-2'>
          <Text strong className='text-sm'>
            {t('参考图')}
          </Text>
          <Text className='text-xs text-gray-400'>
            {references.length}/{MAX_REFERENCE_IMAGES}
          </Text>
        </div>

        <div className='flex flex-wrap gap-3'>
          {references.map((asset) => (
            <div
              key={asset.id}
              className='relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200'
            >
              <img
                src={asset.src}
                alt={asset.name}
                className='w-full h-full object-cover'
              />
              <Button
                icon={<X size={12} />}
                theme='solid'
                type='danger'
                size='small'
                className='!absolute !top-1 !right-1 !rounded-full !w-5 !h-5 !p-0 !min-w-0'
                onClick={() => removeReference(asset.id)}
                disabled={disabled}
              />
            </div>
          ))}

          {references.length < MAX_REFERENCE_IMAGES && (
            <button
              type='button'
              onClick={() => referenceInputRef.current?.click()}
              disabled={disabled}
              className='w-24 h-24 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors disabled:opacity-50'
            >
              <ImagePlus size={20} />
              <span className='text-xs mt-1'>{t('添加参考图')}</span>
            </button>
          )}
        </div>

        <input
          ref={referenceInputRef}
          type='file'
          accept='image/png,image/jpeg,image/webp'
          multiple
          hidden
          onChange={handleReferenceFiles}
        />
      </div>

      <div>
        <div className='flex items-center justify-between mb-2'>
          <Text strong className='text-sm'>
            {t('遮罩 (mask)')}
          </Text>
          <Text className='text-xs text-gray-400'>
            {t('可选，需与首张参考图尺寸一致的 PNG')}
          </Text>
        </div>

        <div className='flex items-center gap-3'>
          {mask ? (
            <div className='relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200'>
              <img
                src={mask.src}
                alt={mask.name}
                className='w-full h-full object-cover'
              />
              <Button
                icon={<X size={12} />}
                theme='solid'
                type='danger'
                size='small'
                className='!absolute !top-1 !right-1 !rounded-full !w-5 !h-5 !p-0 !min-w-0'
                onClick={() => onMaskChange(null)}
                disabled={disabled}
              />
            </div>
          ) : (
            <Button
              icon={<Eraser size={16} />}
              theme='outline'
              type='tertiary'
              className='!rounded-lg'
              onClick={() => maskInputRef.current?.click()}
              disabled={disabled || references.length === 0}
            >
              {t('上传遮罩')}
            </Button>
          )}
        </div>

        <input
          ref={maskInputRef}
          type='file'
          accept='image/png'
          hidden
          onChange={handleMaskFile}
        />
      </div>
    </div>
  );
};

export default DrawingReferenceUploader;
