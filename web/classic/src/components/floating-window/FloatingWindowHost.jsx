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

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  activateWindow,
  clampWindowsToViewport,
  clearWindows,
  closeWindow,
  updateWindowRect,
  useFloatingWindows,
} from '../../helpers/floatingWindowStore';
import FloatingWindowFrame from './FloatingWindowFrame';
import { FLOATING_WINDOW_DESKTOP_BREAKPOINT } from './geometry';

const FloatingWindowHost = () => {
  const [viewport, setViewport] = useState(null);
  const { windows } = useFloatingWindows();

  useEffect(() => {
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);

    return () => {
      window.removeEventListener('resize', updateViewport);
    };
  }, []);

  useEffect(() => {
    return () => {
      clearWindows();
    };
  }, []);

  const isDesktop =
    viewport !== null && viewport.width >= FLOATING_WINDOW_DESKTOP_BREAKPOINT;

  useEffect(() => {
    if (!isDesktop || !viewport) return;

    clampWindowsToViewport(viewport);
  }, [isDesktop, viewport]);

  const orderedWindows = useMemo(
    () => [...windows].sort((first, second) => first.order - second.order),
    [windows],
  );

  if (!isDesktop) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 45,
        pointerEvents: 'none',
      }}
    >
      {orderedWindows.map((descriptor) => (
        <FloatingWindowFrame
          key={descriptor.instanceId}
          descriptor={descriptor}
          viewport={viewport}
          onActivate={activateWindow}
          onClose={closeWindow}
          onRectChange={updateWindowRect}
        />
      ))}
    </div>,
    document.body,
  );
};

export default FloatingWindowHost;
