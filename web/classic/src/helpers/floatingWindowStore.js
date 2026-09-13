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

import { useSyncExternalStore } from 'react';

import {
  clampFloatingWindowRect,
  createDefaultFloatingWindowRect,
  FLOATING_WINDOW_DESKTOP_BREAKPOINT,
  floatingWindowRectsEqual,
} from '../components/floating-window/geometry';

const CHANNEL_EDITOR_KIND = 'channel-editor';

let state = { windows: [], activeWindowId: null };

const listeners = new Set();

const emitChange = () => {
  listeners.forEach((listener) => {
    listener();
  });
};

const setState = (nextState) => {
  state = nextState;
  emitChange();
};

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getSnapshot = () => state;

export const useFloatingWindows = () =>
  useSyncExternalStore(subscribe, getSnapshot);

let fallbackInstanceSequence = 0;

const createInstanceId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  fallbackInstanceSequence += 1;
  return `floating-window-${Date.now()}-${fallbackInstanceSequence}`;
};

const getHighestOrder = (windows) =>
  windows.reduce(
    (highestOrder, descriptor) => Math.max(highestOrder, descriptor.order),
    0,
  );

const getTopWindowId = (windows) => {
  let topWindow;

  for (const descriptor of windows) {
    if (!topWindow || descriptor.order > topWindow.order) {
      topWindow = descriptor;
    }
  }

  return topWindow ? topWindow.instanceId : null;
};

const getChannelId = (options) => {
  if (options.mode === 'create') return null;

  if (
    typeof options.channelId !== 'number' ||
    !Number.isFinite(options.channelId)
  ) {
    throw new Error('An edit channel window requires a numeric channelId.');
  }

  return options.channelId;
};

const getWindowIdentity = ({ kind, mode, channelId }) => {
  if (kind === CHANNEL_EDITOR_KIND && mode === 'edit') {
    return `${CHANNEL_EDITOR_KIND}:edit:${channelId}`;
  }

  return null;
};

export const getCurrentDesktopViewport = () => {
  if (
    typeof window === 'undefined' ||
    window.innerWidth < FLOATING_WINDOW_DESKTOP_BREAKPOINT
  ) {
    return null;
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
};

export const isFloatingWindowSupported = () =>
  getCurrentDesktopViewport() !== null;

const clampForCurrentDesktopViewport = (rect) => {
  const viewport = getCurrentDesktopViewport();
  return viewport ? clampFloatingWindowRect(rect, viewport) : { ...rect };
};

const getDefaultTitle = (options) =>
  options.mode === 'edit' ? '更新渠道信息' : '创建新的渠道';

const createDescriptor = (options, channelId, position, order) => ({
  kind: options.kind,
  mode: options.mode,
  channelId,
  title: options.title || getDefaultTitle(options),
  instanceId: createInstanceId(),
  identity: getWindowIdentity({
    kind: options.kind,
    mode: options.mode,
    channelId,
  }),
  rect: clampForCurrentDesktopViewport(
    options.rect || createDefaultFloatingWindowRect(position),
  ),
  order,
  onClose: options.onClose,
});

export const openWindow = (options) => {
  const channelId = getChannelId(options);
  const identity = getWindowIdentity({
    kind: options.kind,
    mode: options.mode,
    channelId,
  });
  const existingWindow = identity
    ? state.windows.find((descriptor) => descriptor.identity === identity)
    : undefined;

  if (existingWindow) {
    activateWindow(existingWindow.instanceId);
    return existingWindow.instanceId;
  }

  const descriptor = createDescriptor(
    options,
    channelId,
    state.windows.length,
    getHighestOrder(state.windows) + 1,
  );

  setState({
    windows: [...state.windows, descriptor],
    activeWindowId: descriptor.instanceId,
  });

  return descriptor.instanceId;
};

export const openFloatingChannelEditor = (options) => {
  return openWindow({ ...options, kind: CHANNEL_EDITOR_KIND });
};

export const closeWindow = (instanceId) => {
  const windowToClose = state.windows.find(
    (descriptor) => descriptor.instanceId === instanceId,
  );
  if (!windowToClose) return;

  const windows = state.windows.filter(
    (descriptor) => descriptor.instanceId !== instanceId,
  );

  setState({
    windows,
    activeWindowId:
      state.activeWindowId === instanceId
        ? getTopWindowId(windows)
        : state.activeWindowId,
  });

  if (typeof windowToClose.onClose === 'function') {
    windowToClose.onClose(windowToClose);
  }
};

export const clearWindows = () => {
  setState({ windows: [], activeWindowId: null });
};

export const activateWindow = (instanceId) => {
  const targetWindow = state.windows.find(
    (descriptor) => descriptor.instanceId === instanceId,
  );
  if (!targetWindow) return;

  const highestOrder = getHighestOrder(state.windows);
  if (
    targetWindow.order === highestOrder &&
    state.activeWindowId === instanceId
  ) {
    return;
  }

  const order =
    targetWindow.order === highestOrder ? highestOrder : highestOrder + 1;

  setState({
    windows: state.windows.map((descriptor) =>
      descriptor.instanceId === instanceId
        ? { ...descriptor, order }
        : descriptor,
    ),
    activeWindowId: instanceId,
  });
};

export const updateWindowRect = (instanceId, rect) => {
  const nextRect = clampForCurrentDesktopViewport(rect);
  const targetWindow = state.windows.find(
    (descriptor) => descriptor.instanceId === instanceId,
  );
  if (
    !targetWindow ||
    floatingWindowRectsEqual(targetWindow.rect, nextRect)
  ) {
    return;
  }

  setState({
    ...state,
    windows: state.windows.map((descriptor) =>
      descriptor.instanceId === instanceId
        ? { ...descriptor, rect: nextRect }
        : descriptor,
    ),
  });
};

export const clampWindowsToViewport = (viewport) => {
  let didChange = false;
  const windows = state.windows.map((descriptor) => {
    const rect = clampFloatingWindowRect(descriptor.rect, viewport);
    if (floatingWindowRectsEqual(descriptor.rect, rect)) {
      return descriptor;
    }

    didChange = true;
    return { ...descriptor, rect };
  });

  if (didChange) {
    setState({ ...state, windows });
  }
};
