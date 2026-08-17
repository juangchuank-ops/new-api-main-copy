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

import React, { useEffect, useState } from 'react';
import { Banner } from '@douyinfe/semi-ui';
import { IconClose } from '@douyinfe/semi-icons';
import { API } from '../../helpers';

const bannerTypes = {
  default: 'info',
  ongoing: 'info',
  success: 'success',
  warning: 'warning',
  error: 'danger',
};

function isSafeLink(link) {
  if (!link) return false;
  try {
    const url = new URL(link);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const CLOSED_BANNER_KEY = 'closed_banner_ids';

function getClosedBannerIds() {
  try {
    const raw = sessionStorage.getItem(CLOSED_BANNER_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

const PublicBanners = ({ style }) => {
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    let mounted = true;

    const loadBanners = async () => {
      try {
        const res = await API.get('/api/banners');
        if (mounted && res.data?.success && Array.isArray(res.data.data)) {
          const closedIds = getClosedBannerIds();
          setBanners(
            res.data.data.filter((b) => !closedIds.includes(b.id)),
          );
        }
      } catch {
        // Banners are supplemental public content; a failed request should not block the page.
      }
    };

    loadBanners();
    return () => {
      mounted = false;
    };
  }, []);

  const handleClose = (id) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
    try {
      const closedIds = getClosedBannerIds();
      if (!closedIds.includes(id)) {
        closedIds.push(id);
        sessionStorage.setItem(CLOSED_BANNER_KEY, JSON.stringify(closedIds));
      }
    } catch {
      // sessionStorage may be unavailable (e.g. private mode); ignore.
    }
  };

  if (banners.length === 0) return null;

  return (
    <div
      className='w-full px-4 sm:px-6 lg:px-8 space-y-2'
      style={style}
    >
      {banners.map((banner) => {
        const link = isSafeLink(banner.link) ? banner.link : '';
        const content = link ? (
          <a href={link} target='_blank' rel='noopener noreferrer'>
            {banner.content}
          </a>
        ) : (
          banner.content
        );

        return (
          <Banner
            key={banner.id}
            type={bannerTypes[banner.type] || 'info'}
            description={content}
            closeIcon={<IconClose />}
            onClose={() => handleClose(banner.id)}
            fullMode={false}
          />
        );
      })}
    </div>
  );
};

export default PublicBanners;