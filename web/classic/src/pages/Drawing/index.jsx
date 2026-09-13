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

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@douyinfe/semi-ui';
import { Palette } from 'lucide-react';
import { UserContext } from '../../context/User';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { useDrawingModels } from '../../hooks/drawing/useDrawingModels';
import { useImageGeneration } from '../../hooks/drawing/useImageGeneration';
import DrawingPanel from '../../components/drawing/DrawingPanel';
import {
  DEFAULT_DRAWING_SETTINGS,
  generateAssetId,
  settingsForImageModel,
} from '../../helpers/drawing';

const { Title, Text } = Typography;

const Drawing = () => {
  const { t } = useTranslation();
  const [userState] = useContext(UserContext);
  const isMobile = useIsMobile();

  const { models, groups, defaultModel, defaultGroup } =
    useDrawingModels(userState);
  const { generate, cancel, isGenerating } = useImageGeneration();

  const [settings, setSettings] = useState(DEFAULT_DRAWING_SETTINGS);
  const [references, setReferences] = useState([]);
  const [mask, setMask] = useState(null);
  const [history, setHistory] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);

  useEffect(() => {
    if (models.length > 0 && defaultModel) {
      setSettings((prev) =>
        prev.model ? prev : settingsForImageModel(prev, defaultModel),
      );
    }
  }, [models, defaultModel]);

  useEffect(() => {
    if (groups.length > 0 && defaultGroup) {
      setSettings((prev) =>
        prev.group ? prev : { ...prev, group: defaultGroup },
      );
    }
  }, [groups, defaultGroup]);

  const handleSettingChange = useCallback((key, value) => {
    setSettings((prev) => {
      if (key === 'model') {
        return settingsForImageModel(prev, value);
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const handlePartial = useCallback(
    (image, index) => {
      setPreviewImages((prev) => {
        const next = [...prev];
        next[index] = {
          id: `preview-${index}`,
          src: image.src,
          mimeType: image.mimeType,
          prompt: settings.prompt,
          status: 'preview',
        };
        return next;
      });
    },
    [settings.prompt],
  );

  const handleComplete = useCallback(
    ({ images }) => {
      const items = images.map((image, index) => ({
        id: generateAssetId(),
        src: image.src,
        mimeType: image.mimeType,
        revisedPrompt: image.revisedPrompt,
        prompt: settings.prompt,
        name: `${settings.model || 'drawing'}-${index + 1}`,
        createdAt: Date.now(),
      }));
      setHistory((prev) => [...prev, ...items]);
      setPreviewImages([]);
    },
    [settings.prompt, settings.model],
  );

  const handleGenerate = useCallback(() => {
    setPreviewImages([]);
    generate({
      settings,
      references,
      mask,
      onPartial: handlePartial,
      onComplete: handleComplete,
    });
  }, [generate, settings, references, mask, handlePartial, handleComplete]);

  const handleDelete = useCallback((id) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
    setPreviewImages((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleClear = useCallback(() => {
    setHistory([]);
    setPreviewImages([]);
  }, []);

  const galleryImages = useMemo(
    () => [...history, ...previewImages].filter(Boolean),
    [history, previewImages],
  );

  return (
    <div className='w-full mt-[60px] px-2'>
      <div className='flex items-center gap-3 mb-4'>
        <span className='w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center'>
          <Palette size={20} className='text-white' />
        </span>
        <div>
          <Title heading={5} className='mb-0'>
            {t('绘图操场')}
          </Title>
          <Text className='text-sm text-gray-500'>
            {t('文生图与图生图，支持流式预览与参考图编辑')}
          </Text>
        </div>
      </div>

      <DrawingPanel
        settings={settings}
        onSettingChange={handleSettingChange}
        models={models}
        groups={groups}
        references={references}
        mask={mask}
        onReferencesChange={setReferences}
        onMaskChange={setMask}
        images={galleryImages}
        isGenerating={isGenerating}
        onGenerate={handleGenerate}
        onCancel={cancel}
        onDelete={handleDelete}
        onClear={handleClear}
      />
    </div>
  );
};

export default Drawing;
