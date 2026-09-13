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
import { Card, Button, Typography } from '@douyinfe/semi-ui';
import { Settings, Wand2, Square, Image as ImageIcon } from 'lucide-react';
import DrawingSettings from './DrawingSettings';
import DrawingReferenceUploader from './DrawingReferenceUploader';
import DrawingGallery from './DrawingGallery';
import { DRAWING_MODES } from '../../helpers/drawing';

const { Title } = Typography;

const DrawingPanel = ({
  settings,
  onSettingChange,
  models = [],
  groups = [],
  references = [],
  mask,
  onReferencesChange,
  onMaskChange,
  images = [],
  isGenerating = false,
  onGenerate,
  onCancel,
  onDelete,
  onClear,
}) => {
  const { t } = useTranslation();
  const isEditMode = settings.mode === DRAWING_MODES.EDIT;

  return (
    <div className='flex flex-col lg:flex-row gap-4 h-full'>
      <div className='w-full lg:w-80 flex-shrink-0'>
        <Card
          className='h-full !rounded-2xl'
          title={
            <div className='flex items-center gap-2'>
              <span className='w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center'>
                <Settings size={16} className='text-white' />
              </span>
              <Title heading={6} className='mb-0'>
                {t('绘图设置')}
              </Title>
            </div>
          }
          bodyStyle={{ padding: '16px' }}
        >
          <DrawingSettings
            settings={settings}
            onChange={onSettingChange}
            models={models}
            groups={groups}
            disabled={isGenerating}
          />
        </Card>
      </div>

      <div className='flex-1 min-w-0 space-y-4'>
        {isEditMode && (
          <Card className='!rounded-2xl' bodyStyle={{ padding: '16px' }}>
            <DrawingReferenceUploader
              references={references}
              mask={mask}
              onReferencesChange={onReferencesChange}
              onMaskChange={onMaskChange}
              disabled={isGenerating}
            />
          </Card>
        )}

        <div className='flex items-center gap-2'>
          <Button
            icon={<Wand2 size={16} />}
            theme='solid'
            type='primary'
            loading={isGenerating}
            onClick={onGenerate}
            disabled={isGenerating}
            className='!rounded-lg'
          >
            {isEditMode ? t('开始编辑') : t('开始生成')}
          </Button>
          {isGenerating && (
            <Button
              icon={<Square size={16} />}
              theme='light'
              type='danger'
              onClick={onCancel}
              className='!rounded-lg'
            >
              {t('取消')}
            </Button>
          )}
        </div>

        <Card
          className='!rounded-2xl min-h-[320px]'
          title={
            <div className='flex items-center gap-2'>
              <ImageIcon size={16} className='text-gray-500' />
              <Title heading={6} className='mb-0'>
                {t('绘图画廊')}
              </Title>
            </div>
          }
          bodyStyle={{ padding: '16px' }}
        >
          <DrawingGallery
            images={images}
            isGenerating={isGenerating}
            onDelete={onDelete}
            onClear={onClear}
          />
        </Card>
      </div>
    </div>
  );
};

export default DrawingPanel;
