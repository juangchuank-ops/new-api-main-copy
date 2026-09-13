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

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  API,
  processModelsData,
  processGroupsData,
  showError,
} from '../../helpers';
import { API_ENDPOINTS } from '../../constants/playground.constants';

const IMAGE_MODEL_PATTERN = /gpt-image|dall-e|chatgpt-image|image/i;

export const useDrawingModels = (userState) => {
  const { t } = useTranslation();
  const [models, setModels] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [defaultGroup, setDefaultGroup] = useState('');

  const loadModels = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await API.get(API_ENDPOINTS.USER_MODELS);
      const { success, message, data } = res.data;

      if (!success) {
        setError(t(message));
        showError(t(message));
        return;
      }

      const list = Array.isArray(data) ? data : [];
      const preferred = list.find((model) => IMAGE_MODEL_PATTERN.test(model));
      const { modelOptions, selectedModel } = processModelsData(
        list,
        preferred,
      );
      setModels(modelOptions);
      setDefaultModel(selectedModel || '');
    } catch (err) {
      setError(t('加载模型失败'));
      showError(t('加载模型失败'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadGroups = useCallback(async () => {
    try {
      const res = await API.get(API_ENDPOINTS.USER_GROUPS);
      const { success, message, data } = res.data;

      if (!success) {
        showError(t(message));
        return;
      }

      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      const userGroup = userState?.user?.group || storedUser?.group;
      const groupOptions = processGroupsData(data, userGroup);
      setGroups(groupOptions);
      setDefaultGroup(groupOptions[0]?.value || '');
    } catch (err) {
      showError(t('加载分组失败'));
    }
  }, [userState, t]);

  useEffect(() => {
    if (userState?.user) {
      loadModels();
      loadGroups();
    }
  }, [userState?.user, loadModels, loadGroups]);

  return {
    models,
    groups,
    loading,
    error,
    defaultModel,
    defaultGroup,
    reload: loadModels,
  };
};
