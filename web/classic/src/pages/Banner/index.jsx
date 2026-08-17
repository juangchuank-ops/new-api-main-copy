import React from 'react';
import { Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import BannersPanel from '../../components/banner/BannersPanel';

const { Title, Text } = Typography;

const Banner = () => {
  const { t } = useTranslation();

  return (
    <div className='flex flex-col gap-4 mt-[60px] px-2'>
      <div>
        <Title heading={4} style={{ marginBottom: 4 }}>
          {t('横幅管理')}
          <Text
            type='tertiary'
            size='small'
            style={{ marginLeft: 8, fontWeight: 400 }}
          >
            Admin
          </Text>
        </Title>
      </div>
      <BannersPanel />
    </div>
  );
};

export default Banner;
