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

import { useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showError } from '../../helpers';
import { StatusContext } from '../../context/Status';
import { UserContext } from '../../context/User';

/**
 * 模型详情页数据 Hook
 *
 * 复用「模型广场」使用的 /api/pricing 接口，按 modelId（模型名）定位单个模型，
 * 并暴露详情页需要展示的倍率、价格等上下文数据。
 *
 * @param {string} modelId 已解码的模型名称
 */
export const useModelDetail = (modelId) => {
  const { t } = useTranslation();

  const [statusState] = useContext(StatusContext);
  const [userState] = useContext(UserContext);

  const [models, setModels] = useState([]);
  const [groupRatio, setGroupRatio] = useState({});
  const [usableGroup, setUsableGroup] = useState({});
  const [endpointMap, setEndpointMap] = useState({});
  const [vendorsMap, setVendorsMap] = useState({});
  const [autoGroups, setAutoGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [currency, setCurrency] = useState('USD');
  const [showWithRecharge, setShowWithRecharge] = useState(false);
  const [tokenUnit, setTokenUnit] = useState('M');

  const priceRate = useMemo(
    () => statusState?.status?.price ?? 1,
    [statusState],
  );
  const usdExchangeRate = useMemo(
    () => statusState?.status?.usd_exchange_rate ?? priceRate,
    [statusState, priceRate],
  );
  const customExchangeRate = useMemo(
    () => statusState?.status?.custom_currency_exchange_rate ?? 1,
    [statusState],
  );
  const customCurrencySymbol = useMemo(
    () => statusState?.status?.custom_currency_symbol ?? '¤',
    [statusState],
  );
  const siteDisplayType = useMemo(
    () => statusState?.status?.quota_display_type || 'USD',
    [statusState],
  );

  useEffect(() => {
    if (
      siteDisplayType === 'USD' ||
      siteDisplayType === 'CNY' ||
      siteDisplayType === 'CUSTOM'
    ) {
      setCurrency(siteDisplayType);
    }
  }, [siteDisplayType]);

  useEffect(() => {
    if (siteDisplayType === 'TOKENS') {
      setShowWithRecharge(false);
      setCurrency('USD');
    }
  }, [siteDisplayType]);

  const loadPricing = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await API.get('/api/pricing');
      const {
        success,
        message,
        data,
        vendors,
        group_ratio,
        usable_group,
        supported_endpoint,
        auto_groups,
      } = res.data;
      if (!success) {
        setLoadError(message || t('加载模型详情失败'));
        showError(message);
        return;
      }

      const ratioMap = group_ratio || {};
      const vendorMap = {};
      if (Array.isArray(vendors)) {
        vendors.forEach((v) => {
          vendorMap[v.id] = v;
        });
      }

      const modelList = (data || []).map((m) => {
        const vendor = m.vendor_id ? vendorMap[m.vendor_id] : null;
        return {
          ...m,
          key: m.model_name,
          group_ratio: ratioMap[m.model_name],
          vendor_name: vendor?.name,
          vendor_icon: vendor?.icon,
          vendor_description: vendor?.description,
        };
      });

      setGroupRatio(ratioMap);
      setUsableGroup(usable_group || {});
      setEndpointMap(supported_endpoint || {});
      setVendorsMap(vendorMap);
      setAutoGroups(auto_groups || []);
      setModels(modelList);
    } catch (error) {
      setLoadError(t('加载模型详情失败'));
      showError(error?.message || t('加载模型详情失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPricing().then();
  }, []);

  const model = useMemo(() => {
    if (!modelId || !Array.isArray(models)) return null;
    return models.find((m) => m.model_name === modelId) || null;
  }, [models, modelId]);

  const displayPrice = (usdPrice) => {
    let priceInUSD = usdPrice;
    if (showWithRecharge) {
      priceInUSD = (usdPrice * priceRate) / usdExchangeRate;
    }

    if (currency === 'CNY') {
      return `¥${(priceInUSD * usdExchangeRate).toFixed(3)}`;
    } else if (currency === 'CUSTOM') {
      return `${customCurrencySymbol}${(priceInUSD * customExchangeRate).toFixed(3)}`;
    }
    return `$${priceInUSD.toFixed(3)}`;
  };

  return {
    loading,
    loadError,
    model,
    models,
    groupRatio,
    usableGroup,
    endpointMap,
    vendorsMap,
    autoGroups,

    currency,
    setCurrency,
    showWithRecharge,
    setShowWithRecharge,
    tokenUnit,
    setTokenUnit,
    siteDisplayType,
    priceRate,
    usdExchangeRate,

    displayPrice,
    refresh: loadPricing,
    userState,
    t,
  };
};
