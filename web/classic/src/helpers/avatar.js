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

const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;
const MAX_AVATAR_DATA_URL_LENGTH = 350 * 1024;
const AVATAR_SIZE = 320;
const SUPPORTED_AVATAR_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export function isExternalAvatarUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) {
    return false;
  }
  try {
    const url = new URL(value.trim());
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function isAvatarDataUrl(value) {
  return (
    typeof value === 'string' &&
    value.length <= MAX_AVATAR_DATA_URL_LENGTH &&
    (value.startsWith('data:image/jpeg;base64,') ||
      value.startsWith('data:image/png;base64,') ||
      value.startsWith('data:image/webp;base64,'))
  );
}

export function getUserAvatarUrl(user) {
  if (!user) {
    return '';
  }

  let avatarUrl = user.avatar_url;
  if (!avatarUrl && user.setting) {
    try {
      avatarUrl = JSON.parse(user.setting)?.avatar_url;
    } catch {
      avatarUrl = '';
    }
  }

  return isExternalAvatarUrl(avatarUrl) || isAvatarDataUrl(avatarUrl)
    ? avatarUrl
    : '';
}

export async function compressAvatarFile(file) {
  if (!SUPPORTED_AVATAR_TYPES.has(file?.type)) {
    throw new Error('unsupported_type');
  }
  if (file.size > MAX_AVATAR_FILE_SIZE) {
    throw new Error('file_too_large');
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => URL.revokeObjectURL(objectUrl);
    image.onerror = () => {
      cleanup();
      reject(new Error('process_failed'));
    };
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = AVATAR_SIZE;
        canvas.height = AVATAR_SIZE;
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('process_failed');
        }

        const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
        const sourceX = (image.naturalWidth - sourceSize) / 2;
        const sourceY = (image.naturalHeight - sourceSize) / 2;

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
        context.drawImage(
          image,
          sourceX,
          sourceY,
          sourceSize,
          sourceSize,
          0,
          0,
          AVATAR_SIZE,
          AVATAR_SIZE,
        );

        const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
        if (
          !dataUrl.startsWith('data:image/jpeg;base64,') ||
          dataUrl.length > MAX_AVATAR_DATA_URL_LENGTH
        ) {
          throw new Error('process_failed');
        }
        resolve(dataUrl);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('process_failed'));
      } finally {
        cleanup();
      }
    };
    image.src = objectUrl;
  });
}
