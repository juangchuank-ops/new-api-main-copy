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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banner,
  Button,
  Col,
  Form,
  Input,
  Row,
  Spin,
  Typography,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess, showWarning } from '../../../helpers';
import {
  CUSTOM_THEME_PRESET,
  DEFAULT_CUSTOM_THEME_COLOR,
  DEFAULT_THEME_PRESET,
  THEME_PRESETS,
  normalizeCustomColor,
  resolveAccentColor,
} from '../../../helpers/theme-customization';

const { Text } = Typography;

// 与后端 setting.DefaultThemeOptionKey 保持一致
const OPTION_KEY = 'theme.default';

// 与后端 setting.DefaultThemeSettings 保持一致，仅在 option 缺失/损坏时兜底
const FALLBACK_THEME_SETTINGS = {
  mode: 'system',
  preset: DEFAULT_THEME_PRESET,
  custom_color: DEFAULT_CUSTOM_THEME_COLOR,
  font: 'default',
  radius: 'default',
  scale: 'default',
  content_layout: 'full',
  sidebar_variant: 'inset',
  sidebar_collapsible: 'icon',
  sidebar_open: true,
  direction: 'ltr',
};

// 解析后端保存的字符串 JSON，保留 font/radius/scale/... 等字段原值
const parseThemeOption = (rawValue) => {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') {
    return { ...FALLBACK_THEME_SETTINGS };
  }
  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ...FALLBACK_THEME_SETTINGS, ...parsed };
    }
  } catch {
    // 存储值损坏时回退后端默认值
  }
  return { ...FALLBACK_THEME_SETTINGS };
};

export default function SettingsTheme(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [themeSettings, setThemeSettings] = useState(() => ({
    ...FALLBACK_THEME_SETTINGS,
  }));
  const [savedSettings, setSavedSettings] = useState(() => ({
    ...FALLBACK_THEME_SETTINGS,
  }));
  const refForm = useRef();

  const isCustomPreset = themeSettings.preset === CUSTOM_THEME_PRESET;
  const isDirty =
    themeSettings.mode !== savedSettings.mode ||
    themeSettings.preset !== savedSettings.preset ||
    themeSettings.custom_color !== savedSettings.custom_color;

  const modeOptions = useMemo(
    () => [
      { value: 'system', label: t('自动模式') },
      { value: 'light', label: t('浅色模式') },
      { value: 'dark', label: t('深色模式') },
    ],
    [t],
  );

  const presetOptions = useMemo(
    () => [
      ...THEME_PRESETS.map((item) => ({
        value: item.value,
        label: t(item.label),
      })),
      { value: CUSTOM_THEME_PRESET, label: t('自定义') },
    ],
    [t],
  );

  const lightAccent =
    resolveAccentColor(themeSettings.preset, themeSettings.custom_color, false) ||
    'var(--semi-color-primary)';
  const darkAccent =
    resolveAccentColor(themeSettings.preset, themeSettings.custom_color, true) ||
    'var(--semi-color-primary)';

  useEffect(() => {
    const next = parseThemeOption(props.options?.[OPTION_KEY]);
    setThemeSettings(next);
    setSavedSettings(next);
    if (refForm.current) refForm.current.setValues(next);
  }, [props.options]);

  const updateForm = (patch) => setThemeSettings((prev) => ({ ...prev, ...patch }));

  async function onSubmit() {
    if (!isDirty) {
      showWarning(t('你似乎并没有修改什么'));
      return;
    }
    const normalizedColor = normalizeCustomColor(themeSettings.custom_color);
    if (!normalizedColor) {
      showError(t('颜色格式不正确，请使用 #rrggbb'));
      return;
    }
    // 只覆盖 mode/preset/custom_color，其余字段保持后端返回的原值
    const optionValue = JSON.stringify({
      ...themeSettings,
      custom_color: normalizedColor,
    });
    setLoading(true);
    try {
      const res = await API.put('/api/option/', {
        key: OPTION_KEY,
        value: optionValue,
      });
      const { success, message } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      showSuccess(t('保存成功'));
      props.refresh();
    } catch (error) {
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Spin spinning={loading}>
      <Form
        values={themeSettings}
        getFormApi={(formAPI) => (refForm.current = formAPI)}
        style={{ marginBottom: 15 }}
      >
        <Form.Section text={t('主题设置')}>
          <Banner
            fullMode={false}
            type='info'
            description={t(
              '全局默认主题对未自行设置主题的用户生效，用户个人选择优先。当前版本仅调整主色（强调色），中性背景保持 classic 现状。',
            )}
          />
          <Row gutter={16} style={{ marginTop: 12 }}>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Select
                field={'mode'}
                label={t('默认明暗模式')}
                optionList={modeOptions}
                style={{ width: '100%' }}
                extraText={t('自动模式会跟随系统明暗设置。')}
                onChange={(value) => updateForm({ mode: value })}
              />
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Form.Select
                field={'preset'}
                label={t('默认主题色')}
                optionList={presetOptions}
                style={{ width: '100%' }}
                extraText={t('选择「自定义」后可使用任意主色，其余预设为内置配色。')}
                onChange={(value) => updateForm({ preset: value })}
              />
            </Col>
          </Row>
          <Row gutter={16} style={{ marginTop: 12 }}>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Text strong>{t('自定义主题色')}</Text>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 8,
                }}
              >
                <input
                  type='color'
                  value={
                    normalizeCustomColor(themeSettings.custom_color) ||
                    DEFAULT_CUSTOM_THEME_COLOR
                  }
                  disabled={!isCustomPreset}
                  onChange={(event) =>
                    updateForm({ custom_color: event.target.value })
                  }
                  aria-label={t('自定义主题色')}
                  title={t('自定义主题色')}
                  style={{
                    width: 40,
                    height: 30,
                    padding: 0,
                    cursor: isCustomPreset ? 'pointer' : 'not-allowed',
                    background: 'transparent',
                    border: '1px solid var(--semi-color-border)',
                    borderRadius: 4,
                  }}
                />
                <Input
                  value={themeSettings.custom_color}
                  disabled={!isCustomPreset}
                  onChange={(value) => updateForm({ custom_color: value })}
                  aria-label={t('自定义主题色')}
                  style={{ width: 140 }}
                />
              </div>
              <Text
                type='tertiary'
                size='small'
                style={{ display: 'block', marginTop: 4, marginBottom: 8 }}
              >
                {t('仅在选择「自定义」预设时可编辑，格式为 #rrggbb。')}
              </Text>
            </Col>
            <Col xs={24} sm={12} md={8} lg={8} xl={8}>
              <Text strong>{t('主色预览')}</Text>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  marginTop: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      background: lightAccent,
                      border: '1px solid var(--semi-color-border)',
                    }}
                  />
                  <Text size='small'>{t('浅色模式')}</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      background: darkAccent,
                      border: '1px solid var(--semi-color-border)',
                    }}
                  />
                  <Text size='small'>{t('深色模式')}</Text>
                </div>
              </div>
              <Text
                type='tertiary'
                size='small'
                style={{ display: 'block', marginTop: 4, marginBottom: 8 }}
              >
                {t('选择「默认」时使用 Semi 原生主色。')}
              </Text>
            </Col>
          </Row>
          <Row>
            <Button size='default' onClick={onSubmit}>
              {t('保存主题设置')}
            </Button>
          </Row>
        </Form.Section>
      </Form>
    </Spin>
  );
}
