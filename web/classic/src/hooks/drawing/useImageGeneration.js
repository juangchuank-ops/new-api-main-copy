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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { showError } from '../../helpers';
import {
  DRAWING_ENDPOINTS,
  DRAWING_MODES,
  buildDrawingHeaders,
  buildImagePayload,
  getImageModelFamily,
  imageAssetToFile,
  parseImageResponse,
  readImageStream,
  validateDrawingSettings,
} from '../../helpers/drawing';

export const useImageGeneration = () => {
  const { t } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(false);
  const controllerRef = useRef(null);

  const cancel = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    setIsGenerating(false);
  }, []);

  const generate = useCallback(
    async ({ settings, references = [], mask, onPartial, onComplete }) => {
      const validationError = validateDrawingSettings(
        settings,
        references.length,
      );
      if (validationError) {
        showError(t(validationError));
        return false;
      }

      if (controllerRef.current) {
        controllerRef.current.abort();
      }
      const controller = new AbortController();
      controllerRef.current = controller;
      setIsGenerating(true);

      try {
        const payload = buildImagePayload(settings);
        const isEdit = settings.mode === DRAWING_MODES.EDIT;
        const headers = buildDrawingHeaders(!isEdit);
        let body;

        if (isEdit) {
          if (
            mask &&
            (mask.mimeType !== 'image/png' ||
              mask.width !== references[0].width ||
              mask.height !== references[0].height)
          ) {
            throw new Error('mask 必须是与首张参考图尺寸一致的 PNG 图片。');
          }
          const files = await Promise.all(
            references.map((asset) =>
              imageAssetToFile(asset, controller.signal),
            ),
          );
          if (
            getImageModelFamily(settings.model) === 'dall-e-2' &&
            (files[0].type !== 'image/png' ||
              files[0].size >= 4 * 1024 * 1024 ||
              references[0].width !== references[0].height)
          ) {
            throw new Error('DALL·E 2 需要小于 4MB 的正方形 PNG 图片。');
          }
          const form = new FormData();
          Object.entries(payload).forEach(([key, value]) => {
            form.append(key, String(value));
          });
          files.forEach((file) => {
            form.append(files.length === 1 ? 'image' : 'image[]', file);
          });
          if (mask) {
            const maskFile = await imageAssetToFile(mask, controller.signal);
            if (maskFile.size >= 4 * 1024 * 1024) {
              throw new Error('mask 必须小于 4MB。');
            }
            form.append('mask', maskFile);
          }
          body = form;
        } else {
          body = JSON.stringify(payload);
        }

        if (controller.signal.aborted) {
          throw controller.signal.reason;
        }

        const endpoint = isEdit
          ? DRAWING_ENDPOINTS.EDITS
          : DRAWING_ENDPOINTS.GENERATIONS;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });

        if (!response.ok) {
          let message = '';
          try {
            const errorBody = await response.json();
            message = errorBody?.error?.message || '';
          } catch (_) {
            message = '';
          }
          throw new Error(message || `请求失败（HTTP ${response.status}）`);
        }

        const contentType = response.headers.get('content-type') || '';
        const outputFormat =
          getImageModelFamily(settings.model) === 'gpt-image'
            ? settings.outputFormat
            : 'png';

        let result;
        if (contentType.includes('text/event-stream') && response.body) {
          result = await readImageStream(
            response.body,
            outputFormat,
            onPartial,
            controller.signal,
          );
        } else {
          const data = await response.json();
          result = {
            images: parseImageResponse(data, outputFormat),
            usage: data.usage,
          };
        }

        if (controller.signal.aborted) {
          throw controller.signal.reason;
        }
        if (onComplete) {
          onComplete(result);
        }
        return true;
      } catch (error) {
        if (controller.signal.aborted) {
          return false;
        }
        showError(error.message || t('图像生成失败'));
        return false;
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
          setIsGenerating(false);
        }
      }
    },
    [t],
  );

  useEffect(
    () => () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    },
    [],
  );

  return { generate, cancel, isGenerating };
};
