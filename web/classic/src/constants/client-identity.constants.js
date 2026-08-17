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

// 渠道客户端身份（settings.client_identity）常量，与后端 relaykit/dto/channel_settings.go
// 的 ClientIdentityConfig 契约保持一致：渠道转发时按所选身份携带对应客户端的
// 请求头（User-Agent 等）与版本。

// 支持配置客户端身份的渠道类型
export const CLIENT_IDENTITY_CHANNEL_TYPES = new Set([1, 14, 57, 61, 62, 63]);

// OpenAI(1)/Anthropic(14) 为轻量类型：可在 5 个轻量身份中选择
export const CLIENT_IDENTITY_LIGHTWEIGHT_TYPES = new Set([1, 14]);

// 各渠道类型的默认身份（与后端 DefaultClientIdentityConfig 一致）
export const CLIENT_IDENTITY_DEFAULTS = {
  1: { client_type: 'none', profile: 'none' },
  14: { client_type: 'none', profile: 'none' },
  57: { client_type: 'codex', profile: 'codex_legacy' },
  61: { client_type: 'codex', profile: 'codex_compatibility' },
  62: { client_type: 'claude_code', profile: 'claude_code' },
  63: { client_type: 'codebuddy', profile: 'codebuddy' },
};

// 身份显示名（键即 i18n key）
export const CLIENT_IDENTITY_PROFILE_LABELS = {
  none: '无客户端',
  codex_legacy: 'Codex (legacy)',
  codex_compatibility: 'Codex',
  claude_code: 'Claude Code',
  codebuddy: 'WorkBuddy',
  codex_cli: 'Codex CLI',
  claude_cli: 'Claude CLI',
  codebuddy_cli: 'CodeBuddy CLI',
  workbuddy_desktop: 'WorkBuddy Desktop',
  codex_desktop: 'Codex Desktop',
  claude_desktop: 'Claude Desktop',
};

// 轻量类型可选身份（client_type + profile 对应后端映射）
export const CLIENT_IDENTITY_LIGHTWEIGHT_OPTIONS = [
  { client_type: 'none', profile: 'none' },
  { client_type: 'codex', profile: 'codex_cli' },
  { client_type: 'claude', profile: 'claude_cli' },
  { client_type: 'codebuddy', profile: 'codebuddy_cli' },
  { client_type: 'codex', profile: 'codex_desktop' },
  { client_type: 'claude', profile: 'claude_desktop' },
];

// profile -> client_type（后端 ClientIdentityChannelTypeForProfile 的反向映射）
export const CLIENT_IDENTITY_CLIENT_TYPE_FOR_PROFILE = {
  ...Object.fromEntries(
    CLIENT_IDENTITY_LIGHTWEIGHT_OPTIONS.map((option) => [
      option.profile,
      option.client_type,
    ]),
  ),
  codex_legacy: 'codex',
  codex_compatibility: 'codex',
  claude_code: 'claude_code',
  codebuddy: 'codebuddy',
};

// profile -> 版本来源（后端 ClientIdentitySourceForProfile）：
// npm 从 registry.npmjs.org 拉取版本列表，workbuddy 从官方更新源拉取，manual 手动填写
export const CLIENT_IDENTITY_SOURCE_FOR_PROFILE = {
  none: 'manual',
  codex_legacy: 'npm',
  codex_compatibility: 'npm',
  codex_cli: 'npm',
  claude_code: 'npm',
  claude_cli: 'npm',
  codebuddy: 'workbuddy',
  codebuddy_cli: 'manual',
  workbuddy_desktop: 'manual',
  codex_desktop: 'npm',
  claude_desktop: 'manual',
};

// npm/workbuddy 来源必须携带后端期望的包名（ClientIdentitySourceForProfile），
// 否则后端 Normalize 校验失败并静默回退默认身份
export const CLIENT_IDENTITY_SOURCE_PACKAGE_FOR_PROFILE = {
  none: '',
  codex_legacy: '@openai/codex',
  codex_compatibility: '@openai/codex',
  codex_cli: '@openai/codex',
  claude_code: '@anthropic-ai/claude-code',
  claude_cli: '@anthropic-ai/claude-code',
  codebuddy: '',
  codebuddy_cli: '',
  workbuddy_desktop: '',
  codex_desktop: '@openai/codex',
  claude_desktop: '',
};

// 客户端平台选项
export const CLIENT_IDENTITY_PLATFORMS = [
  { value: 'windows-x64', label: 'Windows x64' },
  { value: 'macos-x64', label: 'macOS x64' },
  { value: 'macos-arm64', label: 'macOS arm64' },
  { value: 'linux-x64', label: 'Linux x64' },
  { value: 'linux-arm64', label: 'Linux arm64' },
];

// 指定渠道类型允许的客户端身份列表
export function allowedClientIdentityProfiles(channelType) {
  const defaults = CLIENT_IDENTITY_DEFAULTS[channelType];
  if (!defaults) {
    return [];
  }
  if (CLIENT_IDENTITY_LIGHTWEIGHT_TYPES.has(channelType)) {
    return CLIENT_IDENTITY_LIGHTWEIGHT_OPTIONS.map((option) => option.profile);
  }
  return [defaults.profile];
}
