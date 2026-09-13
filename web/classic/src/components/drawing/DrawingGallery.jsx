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

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Typography, Empty, Spin } from '@douyinfe/semi-ui';
import { Download, ExternalLink, Trash2, Eraser } from 'lucide-react';
import { showError, showSuccess } from '../../helpers';
import { downloadImageResult } from '../../helpers/drawing';

const { Text } = Typography;

const DrawingGallery = ({
  images = [],
  isGenerating = false,
  onDelete,
  onClear,
}) => {
  const { t } = useTranslation();

  const handleDownload = async (image) => {
    try {
      await downloadImageResult(image, image.name || 'drawing');
      showSuccess(t('下载成功'));
    } catch (error) {
      showError(error.message || t('下载失败'));
    }
  };

  const handleOpen = (image) => {
    window.open(image.src, '_blank', 'noopener,noreferrer');
  };

  if (images.length === 0 && !isGenerating) {
    return (
      <div className='flex flex-col items-center justify-center py-16'>
        <Empty description={t('还没有生成结果')} />
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <Text strong className='text-sm'>
          {t('生成结果')}
        </Text>
        {images.length > 0 && (
          <Button
            icon={<Eraser size={14} />}
            theme='borderless'
            type='tertiary'
            size='small'
            className='!rounded-lg'
            onClick={onClear}
          >
            {t('清空')}
          </Button>
        )}
      </div>

      {isGenerating && (
        <div className='flex items-center gap-2 text-gray-500'>
          <Spin size='small' />
          <Text className='text-sm'>{t('生成中...')}</Text>
        </div>
      )}

      <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'>
        {images.map((image) => (
          <div
            key={image.id}
            className='group relative rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm'
          >
            <div className='w-full aspect-square bg-gray-50 flex items-center justify-center'>
              <img
                src={image.src}
                alt={image.prompt || 'drawing'}
                className='w-full h-full object-contain'
              />
            </div>

            <div className='absolute inset-x-0 top-0 flex justify-end gap-1 p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-b from-black/40 to-transparent'>
              <Button
                icon={<Download size={14} />}
                theme='solid'
                type='primary'
                size='small'
                className='!rounded-lg'
                onClick={() => handleDownload(image)}
              >
                {t('下载')}
              </Button>
              <Button
                icon={<ExternalLink size={14} />}
                theme='solid'
                type='tertiary'
                size='small'
                className='!rounded-lg'
                onClick={() => handleOpen(image)}
              />
              <Button
                icon={<Trash2 size={14} />}
                theme='solid'
                type='danger'
                size='small'
                className='!rounded-lg'
                onClick={() => onDelete(image.id)}
              />
            </div>

            {image.prompt && (
              <div className='p-2'>
                <Text
                  className='text-xs text-gray-500 line-clamp-2'
                  ellipsis={{ rows: 2 }}
                >
                  {image.prompt}
                </Text>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DrawingGallery;
