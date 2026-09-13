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

import { getUserIdFromLocalStorage } from './utils';
import { getAccessToken } from './auth-session';

export const DRAWING_MODES = {
  GENERATE: 'generate',
  EDIT: 'edit',
};

export const DRAWING_ENDPOINTS = {
  GENERATIONS: '/pg/images/generations',
  EDITS: '/pg/images/edits',
};

export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
export const MAX_REFERENCE_IMAGES = 16;

export const DEFAULT_OUTPUT_FORMAT = 'png';
export const DEFAULT_DRAWING_SIZE = '1024x1024';
export const DEFAULT_DRAWING_QUALITY = 'auto';

export const DEFAULT_DRAWING_SETTINGS = {
  mode: DRAWING_MODES.GENERATE,
  group: '',
  model: '',
  prompt: '',
  size: DEFAULT_DRAWING_SIZE,
  quality: DEFAULT_DRAWING_QUALITY,
  n: 1,
  background: 'auto',
  outputFormat: DEFAULT_OUTPUT_FORMAT,
  outputCompression: 100,
  moderation: 'auto',
  responseFormat: 'b64_json',
  style: 'vivid',
  inputFidelity: 'default',
  stream: false,
  partialImages: 1,
  user: '',
};

export const OUTPUT_FORMAT_OPTIONS = ['png', 'jpeg', 'webp'];

export function getImageModelFamily(model) {
  if (model === 'dall-e-2' || model === 'dall-e') return 'dall-e-2';
  if (model === 'dall-e-3') return 'dall-e-3';
  return 'gpt-image';
}

export function getImageSizes(model) {
  const family = getImageModelFamily(model);
  if (family === 'dall-e-2') return ['256x256', '512x512', '1024x1024'];
  if (family === 'dall-e-3') return ['1024x1024', '1792x1024', '1024x1792'];
  return ['auto', '1024x1024', '1536x1024', '1024x1536'];
}

export function getImageQualities(model) {
  const family = getImageModelFamily(model);
  if (family === 'dall-e-2') return ['standard'];
  if (family === 'dall-e-3') return ['standard', 'hd'];
  return ['auto', 'low', 'medium', 'high'];
}

function isFixedSizeModel(model) {
  return /^(gpt-image-1(?:[.-]|$)|chatgpt-image-latest$)/.test(model);
}

export function settingsForImageModel(settings, model) {
  const next = { ...DEFAULT_DRAWING_SETTINGS, ...settings, model };
  const family = getImageModelFamily(model);
  const qualities = getImageQualities(model);
  if (!qualities.includes(next.quality)) {
    next.quality = qualities[0];
  }
  if (
    !getImageSizes(model).includes(next.size) &&
    (family !== 'gpt-image' || isFixedSizeModel(model))
  ) {
    next.size = DEFAULT_DRAWING_SIZE;
  }
  if (family === 'dall-e-3') {
    next.n = 1;
    next.mode = DRAWING_MODES.GENERATE;
  }
  return next;
}

export function validateDrawingSettings(settings, referenceCount) {
  if (!settings || typeof settings !== 'object') {
    return '请检查图像生成参数。';
  }
  if (!settings.prompt || !settings.prompt.trim()) {
    return '请输入提示词后再生成图片。';
  }
  if (!settings.model || !settings.model.trim()) {
    return '请选择图像模型。';
  }
  if (!settings.group) {
    return '请选择分组。';
  }
  const family = getImageModelFamily(settings.model);
  if (family === 'dall-e-3' && settings.n !== 1) {
    return 'DALL·E 3 每次请求仅支持生成一张图片。';
  }
  if (settings.mode === DRAWING_MODES.EDIT) {
    if (family === 'dall-e-3') return 'DALL·E 3 不支持图像编辑。';
    if (referenceCount === 0) return '请先添加参考图再进行编辑。';
    if (
      referenceCount > MAX_REFERENCE_IMAGES ||
      (family === 'dall-e-2' && referenceCount !== 1)
    ) {
      return 'DALL·E 2 仅支持一张参考图，GPT Image 最多支持 16 张。';
    }
  }
  if (!getImageQualities(settings.model).includes(settings.quality)) {
    return '请选择该模型支持的质量。';
  }
  if (
    family !== 'gpt-image' &&
    !getImageSizes(settings.model).includes(settings.size)
  ) {
    return '请选择该模型支持的尺寸。';
  }
  if (
    settings.size !== 'auto' &&
    !/^[1-9]\d{1,4}x[1-9]\d{1,4}$/.test(settings.size)
  ) {
    return '请输入 WIDTHxHEIGHT 格式的尺寸。';
  }
  if (
    family === 'gpt-image' &&
    !getImageSizes(settings.model).includes(settings.size)
  ) {
    if (isFixedSizeModel(settings.model)) {
      return '请选择该模型支持的尺寸。';
    }
    const [width, height] = settings.size.split('x').map(Number);
    if (
      width % 16 ||
      height % 16 ||
      width / height < 1 / 3 ||
      width / height > 3 ||
      width * height > 3840 * 2160 ||
      Math.max(width, height) > 3840
    ) {
      return '自定义尺寸必须为 16 的倍数，在 3840 × 2160 像素以内，且宽高比在 1:3 到 3:1 之间。';
    }
  }
  if (
    family === 'gpt-image' &&
    settings.background === 'transparent' &&
    settings.outputFormat === 'jpeg'
  ) {
    return '透明背景需要 PNG 或 WebP 格式。';
  }
  if (family === 'dall-e-2' && settings.prompt.length > 1000) {
    return 'DALL·E 2 的提示词不能超过 1000 个字符。';
  }
  if (family === 'dall-e-3' && settings.prompt.length > 4000) {
    return 'DALL·E 3 的提示词不能超过 4000 个字符。';
  }
  return null;
}

export function buildImagePayload(settings) {
  const family = getImageModelFamily(settings.model);
  const payload = {
    model: settings.model,
    prompt: (settings.prompt || '').trim(),
    group: settings.group,
    n: settings.n,
    size: settings.size,
    quality: settings.quality,
  };
  if (settings.user && settings.user.trim()) {
    payload.user = settings.user.trim();
  }
  if (family === 'gpt-image') {
    payload.background = settings.background;
    payload.output_format = settings.outputFormat;
    payload.moderation = settings.moderation;
    payload.stream = settings.stream;
    if (settings.outputFormat !== 'png') {
      payload.output_compression = settings.outputCompression;
    }
    if (settings.stream) {
      payload.partial_images = settings.partialImages;
    }
    if (
      settings.mode === DRAWING_MODES.EDIT &&
      settings.inputFidelity !== 'default'
    ) {
      payload.input_fidelity = settings.inputFidelity;
    }
  } else {
    payload.response_format = settings.responseFormat;
    if (family === 'dall-e-3') {
      payload.style = settings.style;
    }
  }
  return payload;
}

export function buildDrawingHeaders(json = true) {
  const headers = {
    'New-Api-User': getUserIdFromLocalStorage(),
  };
  if (json) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export function generateAssetId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function isSafeImageSource(source) {
  if (typeof source !== 'string' || !source) return false;
  if (/^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/=\s]+$/.test(source)) {
    return true;
  }
  try {
    const url = new URL(source);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch (_) {
    return false;
  }
}

export function extensionForMime(mimeType) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

function resolveMimeType(format) {
  return ['jpeg', 'webp'].includes(format) ? `image/${format}` : 'image/png';
}

function loadImageDimensions(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener(
      'load',
      () => resolve({ width: image.naturalWidth, height: image.naturalHeight }),
      { once: true },
    );
    image.addEventListener('error', () => reject(new Error('无法加载图片。')), {
      once: true,
    });
    image.src = src;
  });
}

export async function imageSourceToAsset(source, name, mimeType) {
  if (!isSafeImageSource(source)) {
    throw new Error('图像响应无效。');
  }
  const dimensions = await loadImageDimensions(source);
  return {
    id: generateAssetId(),
    name: (name || '').slice(0, 512),
    src: source,
    mimeType: mimeType || 'image/png',
    ...dimensions,
  };
}

export async function imageFileToAsset(file) {
  if (!IMAGE_MIME_TYPES.includes(file.type)) {
    throw new Error('请选择 PNG、JPEG 或 WebP 格式的图片。');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('每张参考图必须小于 50 MB。');
  }
  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('无法加载图片。'));
    reader.readAsDataURL(file);
  });
  return imageSourceToAsset(source, file.name, file.type);
}

export async function imageAssetToFile(asset, signal) {
  if (!isSafeImageSource(asset.src)) {
    throw new Error('图像响应无效。');
  }
  const response = await fetch(asset.src, {
    signal,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) {
    throw new Error('无法读取参考图，请重新上传。');
  }
  const blob = await response.blob();
  if (!IMAGE_MIME_TYPES.includes(blob.type)) {
    throw new Error('请选择 PNG、JPEG 或 WebP 格式的图片。');
  }
  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error('每张参考图必须小于 50 MB。');
  }
  return new File([blob], `${asset.id}.${extensionForMime(blob.type)}`, {
    type: blob.type,
  });
}

export function parseImageResult(item, format = DEFAULT_OUTPUT_FORMAT) {
  const mimeType = resolveMimeType(format);
  const src = item.b64_json
    ? `data:${mimeType};base64,${item.b64_json}`
    : item.url;
  if (!src || !isSafeImageSource(src)) {
    throw new Error('图像响应无效。');
  }
  return { src, mimeType, revisedPrompt: item.revised_prompt };
}

export function parseImageResponse(response, format) {
  if (response.error) {
    throw new Error(response.error.message || '图像生成失败。');
  }
  if (!Array.isArray(response.data) || response.data.length === 0) {
    throw new Error('服务器未返回任何图片。');
  }
  return response.data.map((item) =>
    parseImageResult(item, response.output_format || format),
  );
}

export async function readImageStream(stream, format, onPartial, signal) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const completed = new Map();
  let usage;
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  if (signal) signal.addEventListener('abort', cancel, { once: true });
  try {
    let done = false;
    while (!done) {
      if (signal && signal.aborted) throw signal.reason;
      const chunk = await reader.read();
      done = chunk.done;
      buffer += decoder.decode(chunk.value, { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || '';
      if (done && buffer.trim()) blocks.push(buffer);
      for (const block of blocks) {
        const data = block
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (!data || data === '[DONE]') continue;
        const event = JSON.parse(data);
        if (event.error || event.type === 'error') {
          throw new Error(
            event.error?.message || event.message || '图像生成失败。',
          );
        }
        if (
          !event.type?.endsWith('.partial_image') &&
          !event.type?.endsWith('.completed')
        ) {
          continue;
        }
        const image = parseImageResult(event, event.output_format || format);
        const index = event.image_index ?? event.output_index ?? completed.size;
        if (!Number.isInteger(index) || index < 0 || index > 9) {
          throw new Error('图像响应无效。');
        }
        if (event.type.endsWith('.completed')) {
          completed.set(index, image);
          usage = event.usage ?? usage;
        } else if (onPartial) {
          onPartial(image, index);
        }
      }
    }
    if (signal && signal.aborted) throw signal.reason;
    if (completed.size === 0) {
      throw new Error('图像流在生成完成前已结束。');
    }
    return {
      images: [...completed.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, value]) => value),
      usage,
    };
  } finally {
    if (signal) signal.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadImageResult(result, filename) {
  const baseName = (filename || 'image').replace(/[\\/:*?"<>|]/g, '_');
  const name = `${baseName}.${extensionForMime(result.mimeType)}`;
  const response = await fetch(result.src, {
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) {
    throw new Error('无法读取图片。');
  }
  const blob = await response.blob();
  downloadBlob(blob, name);
}
