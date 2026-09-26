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

// 渠道 API 地址（Base URL）智能补全与规范化。
// 适配器会自行拼接完整的 API 路径（如 /v1/chat/completions、/v1/messages、
// /v1beta/models），因此 base URL 尾部的版本前缀残段（v / v1，Gemini 另有
// v1beta）会被规范化为该渠道类型的标准后缀；其它自定义路径（/api、/v2、
// /api/openapi 等）视为有意配置，保持不动。

// base URL 被适配器当作完整地址或特殊模板使用的渠道类型，不做任何补全。
export const CHANNEL_RAW_BASE_URL_TYPES = [
  2, // Midjourney
  5, // Midjourney Plus
  8, // Custom（完整 URL 模板，支持 {model}）
  33, // AWS Bedrock
  41, // Vertex AI
  58, // Advanced Custom（完整自定义请求）
];

// 适配器拼接 /v1beta 版本路径的渠道类型，标准后缀为 /v1beta。
const CHANNEL_GEMINI_TYPES = [11, 24];

const stripTrailingSlashes = (value) => value.replace(/\/+$/, '');

const standardSuffixFor = (channelType) =>
  CHANNEL_GEMINI_TYPES.includes(channelType) ? '/v1beta' : '/v1';

// 返回 { originEnd, path }；originEnd 指向 origin 之后的下标。
const splitOriginAndPath = (value) => {
  const schemeIdx = value.indexOf('://');
  const originEnd = schemeIdx === -1 ? 0 : schemeIdx + 3;
  return { originEnd, path: value.slice(originEnd) };
};

const lastPathSegment = (path) => {
  const slashIdx = path.lastIndexOf('/');
  if (slashIdx === -1) {
    return { segment: '', pathWithoutLast: path };
  }
  return {
    segment: path.slice(slashIdx + 1).toLowerCase(),
    pathWithoutLast: path.slice(0, slashIdx),
  };
};

// 按渠道类型把用户输入规范化为标准形态：
//   https://x           → https://x/v1
//   https://x/          → https://x/v1
//   https://x/v         → https://x/v1
//   https://x/v1/       → https://x/v1
//   https://x/v1        → https://x/v1
// Gemini 类型标准化为 /v1beta；自定义路径保持原样。
export const normalizeChannelBaseURLInput = (
  channelType,
  raw,
  fullRequestURL = false,
) => {
  if (typeof raw !== 'string') {
    return raw;
  }
  const value = stripTrailingSlashes(raw.trim());
  if (
    !value ||
    fullRequestURL ||
    CHANNEL_RAW_BASE_URL_TYPES.includes(channelType)
  ) {
    return value;
  }
  const standardSuffix = standardSuffixFor(channelType);
  const { originEnd, path } = splitOriginAndPath(value);
  const { segment, pathWithoutLast } = lastPathSegment(path);
  if (segment === '') {
    // 裸 origin：补标准后缀
    return value + standardSuffix;
  }
  if (
    segment === 'v' ||
    segment === 'v1' ||
    (CHANNEL_GEMINI_TYPES.includes(channelType) && segment === 'v1beta')
  ) {
    // 版本前缀残段：剥掉后统一补标准后缀
    const withoutFragment = stripTrailingSlashes(
      value.slice(0, originEnd) + pathWithoutLast,
    );
    return withoutFragment + standardSuffix;
  }
  // 其它尾段（已是标准后缀或自定义路径）保持原样
  return value;
};
