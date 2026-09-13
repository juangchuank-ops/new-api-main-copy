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

import React, { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Empty, Spin } from '@douyinfe/semi-ui';
import { ArrowLeft } from 'lucide-react';
import { useModelDetail } from '../../hooks/model-pricing/useModelDetail';
import ModelDetailPanel from '../../components/model-detail/ModelDetailPanel';

const ModelDetail = () => {
  const { t } = useTranslation();
  const { modelId } = useParams();
  const navigate = useNavigate();

  const decodedModelId = useMemo(() => {
    if (!modelId) return '';
    try {
      return decodeURIComponent(modelId);
    } catch (e) {
      return modelId;
    }
  }, [modelId]);

  const detail = useModelDetail(decodedModelId);

  return (
    <div className='classic-page-fill flex flex-col pt-[60px] px-2'>
      <div className='mx-auto w-full max-w-5xl px-4'>
        <Button
          theme='borderless'
          type='tertiary'
          size='small'
          icon={<ArrowLeft size={14} />}
          onClick={() => navigate('/pricing')}
        >
          {t('返回模型广场')}
        </Button>
      </div>

      {detail.loading ? (
        <div className='flex flex-1 justify-center items-center p-8'>
          <Spin size='large' />
        </div>
      ) : !detail.model ? (
        <div className='flex flex-1 justify-center items-center p-8'>
          <Empty
            title={t('模型不存在')}
            description={
              detail.loadError ||
              t('未找到该模型，可能已被移除或暂未开放。')
            }
          >
            <Link to='/pricing'>
              <Button theme='solid' type='primary'>
                {t('返回模型广场')}
              </Button>
            </Link>
          </Empty>
        </div>
      ) : (
        <div className='mx-auto w-full max-w-5xl px-4 pb-10'>
          <ModelDetailPanel
            model={detail.model}
            vendorsMap={detail.vendorsMap}
            groupRatio={detail.groupRatio}
            usableGroup={detail.usableGroup}
            endpointMap={detail.endpointMap}
            autoGroups={detail.autoGroups}
            currency={detail.currency}
            siteDisplayType={detail.siteDisplayType}
            tokenUnit={detail.tokenUnit}
            displayPrice={detail.displayPrice}
            showRatio
            t={detail.t}
          />
        </div>
      )}
    </div>
  );
};

export default ModelDetail;
