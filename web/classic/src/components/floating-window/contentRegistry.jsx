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

import React, { Suspense } from 'react';
import { Spin } from '@douyinfe/semi-ui';

const CHANNEL_EDITOR_KIND = 'channel-editor';

export const FLOATING_WINDOW_REFRESH_EVENT = 'floating-window:refresh-channels';

const LazyChannelEditorModal = React.lazy(
  () => import('../table/channels/modals/EditChannelModal'),
);

const requestChannelsRefresh = () => {
  window.dispatchEvent(new Event(FLOATING_WINDOW_REFRESH_EVENT));
};

const renderChannelEditor = (descriptor, handlers) => {
  const editingChannel =
    descriptor.mode === 'edit' ? { id: descriptor.channelId } : { id: undefined };

  return (
    <Suspense
      fallback={
        <div className='flex items-center justify-center h-full'>
          <Spin />
        </div>
      }
    >
      <LazyChannelEditorModal
        floating
        visible
        refresh={requestChannelsRefresh}
        handleClose={handlers.requestClose}
        editingChannel={editingChannel}
      />
    </Suspense>
  );
};

const CONTENT_RENDERERS = {
  [CHANNEL_EDITOR_KIND]: renderChannelEditor,
};

export const FloatingWindowContent = ({ descriptor, requestClose }) => {
  const renderer = CONTENT_RENDERERS[descriptor.kind];
  if (!renderer) return null;

  return renderer(descriptor, { requestClose });
};
