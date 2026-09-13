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
import {
  RadioGroup,
  Radio,
  Select,
  InputNumber,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import {
  Wand2,
  Users,
  Sparkles,
  Ruler,
  Gauge,
  Hash,
  FileImage,
  MessageSquare,
} from 'lucide-react';
import { renderGroupOption, selectFilter } from '../../helpers';
import {
  DRAWING_MODES,
  getImageModelFamily,
  getImageQualities,
  getImageSizes,
  OUTPUT_FORMAT_OPTIONS,
} from '../../helpers/drawing';

const { Text } = Typography;

const FieldLabel = ({ icon, children }) => (
  <div className='flex items-center gap-2 mb-2'>
    <span className='text-gray-500 flex items-center'>{icon}</span>
    <Text strong className='text-sm'>
      {children}
    </Text>
  </div>
);

const DrawingSettings = ({
  settings,
  onChange,
  models = [],
  groups = [],
  disabled = false,
}) => {
  const { t } = useTranslation();

  const sizeOptions = getImageSizes(settings.model).map((size) => ({
    label: size === 'auto' ? t('自动') : size,
    value: size,
  }));
  const qualityOptions = getImageQualities(settings.model).map((quality) => ({
    label: t(quality),
    value: quality,
  }));
  const outputFormatOptions = OUTPUT_FORMAT_OPTIONS.map((format) => ({
    label: format.toUpperCase(),
    value: format,
  }));

  const isDallE3 = getImageModelFamily(settings.model) === 'dall-e-3';

  return (
    <div className='space-y-6'>
      <div>
        <FieldLabel icon={<Wand2 size={16} />}>{t('模式')}</FieldLabel>
        <RadioGroup
          type='button'
          size='small'
          value={settings.mode}
          onChange={(e) => onChange('mode', e.target.value)}
          disabled={disabled || isDallE3}
        >
          <Radio value={DRAWING_MODES.GENERATE}>{t('文生图')}</Radio>
          <Radio value={DRAWING_MODES.EDIT}>{t('图生图')}</Radio>
        </RadioGroup>
      </div>

      <div>
        <FieldLabel icon={<Users size={16} />}>{t('分组')}</FieldLabel>
        <Select
          placeholder={t('请选择分组')}
          selection
          filter={selectFilter}
          autoClearSearchValue={false}
          optionList={groups}
          renderOptionItem={renderGroupOption}
          value={settings.group}
          onChange={(value) => onChange('group', value)}
          style={{ width: '100%' }}
          dropdownStyle={{ width: '100%', maxWidth: '100%' }}
          className='!rounded-lg'
          disabled={disabled}
        />
      </div>

      <div>
        <FieldLabel icon={<Sparkles size={16} />}>{t('模型')}</FieldLabel>
        <Select
          placeholder={t('请选择模型')}
          selection
          filter={selectFilter}
          autoClearSearchValue={false}
          optionList={models}
          value={settings.model}
          onChange={(value) => onChange('model', value)}
          style={{ width: '100%' }}
          dropdownStyle={{ width: '100%', maxWidth: '100%' }}
          className='!rounded-lg'
          disabled={disabled}
        />
      </div>

      <div>
        <FieldLabel icon={<MessageSquare size={16} />}>
          {t('提示词')}
        </FieldLabel>
        <TextArea
          value={settings.prompt}
          onChange={(value) => onChange('prompt', value)}
          placeholder={t('请输入提示词')}
          autosize={{ minRows: 3, maxRows: 8 }}
          maxCount={32000}
          className='!rounded-lg'
          disabled={disabled}
        />
      </div>

      <div className='flex gap-3'>
        <div className='flex-1'>
          <FieldLabel icon={<Ruler size={16} />}>{t('尺寸')}</FieldLabel>
          <Select
            optionList={sizeOptions}
            value={settings.size}
            onChange={(value) => onChange('size', value)}
            style={{ width: '100%' }}
            className='!rounded-lg'
            disabled={disabled || isDallE3}
          />
        </div>
        <div className='flex-1'>
          <FieldLabel icon={<Gauge size={16} />}>{t('质量')}</FieldLabel>
          <Select
            optionList={qualityOptions}
            value={settings.quality}
            onChange={(value) => onChange('quality', value)}
            style={{ width: '100%' }}
            className='!rounded-lg'
            disabled={disabled}
          />
        </div>
      </div>

      <div className='flex gap-3'>
        <div className='flex-1'>
          <FieldLabel icon={<Hash size={16} />}>{t('生成数量')}</FieldLabel>
          <InputNumber
            value={settings.n}
            onNumberChange={(value) => onChange('n', value)}
            min={1}
            max={10}
            precision={0}
            style={{ width: '100%' }}
            disabled={disabled || isDallE3}
          />
        </div>
        <div className='flex-1'>
          <FieldLabel icon={<FileImage size={16} />}>
            {t('输出格式')}
          </FieldLabel>
          <Select
            optionList={outputFormatOptions}
            value={settings.outputFormat}
            onChange={(value) => onChange('outputFormat', value)}
            style={{ width: '100%' }}
            className='!rounded-lg'
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
};

export default DrawingSettings;
