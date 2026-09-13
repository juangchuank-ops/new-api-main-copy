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

import { MOBILE_BREAKPOINT } from '../../hooks/common/useIsMobile';

export const FLOATING_WINDOW_DESKTOP_BREAKPOINT = MOBILE_BREAKPOINT;

export const FLOATING_WINDOW_MIN_WIDTH = 640;

export const FLOATING_WINDOW_MIN_HEIGHT = 480;

export const DEFAULT_FLOATING_WINDOW_RECT = {
  x: 64,
  y: 64,
  width: 1080,
  height: 760,
};

const finiteOr = (value, fallback) =>
  Number.isFinite(value) ? value : fallback;

const clamp = (value, minimum, maximum) =>
  Math.min(Math.max(value, minimum), maximum);

const clampSize = (value, minimum, viewportSize) => {
  const effectiveMinimum = Math.min(minimum, viewportSize);
  return clamp(value, effectiveMinimum, viewportSize);
};

export const clampFloatingWindowRect = (rect, viewport) => {
  const viewportWidth = Math.max(0, finiteOr(viewport?.width, 0));
  const viewportHeight = Math.max(0, finiteOr(viewport?.height, 0));
  const width = clampSize(
    finiteOr(rect?.width, FLOATING_WINDOW_MIN_WIDTH),
    FLOATING_WINDOW_MIN_WIDTH,
    viewportWidth,
  );
  const height = clampSize(
    finiteOr(rect?.height, FLOATING_WINDOW_MIN_HEIGHT),
    FLOATING_WINDOW_MIN_HEIGHT,
    viewportHeight,
  );

  return {
    x: clamp(finiteOr(rect?.x, 0), 0, Math.max(0, viewportWidth - width)),
    y: clamp(finiteOr(rect?.y, 0), 0, Math.max(0, viewportHeight - height)),
    width,
    height,
  };
};

export const createDefaultFloatingWindowRect = (position) => {
  const normalizedPosition = Number.isFinite(position)
    ? Math.max(0, Math.floor(position))
    : 0;
  const offset = (normalizedPosition % 6) * 28;

  return {
    ...DEFAULT_FLOATING_WINDOW_RECT,
    x: DEFAULT_FLOATING_WINDOW_RECT.x + offset,
    y: DEFAULT_FLOATING_WINDOW_RECT.y + offset,
  };
};

export const floatingWindowRectsEqual = (first, second) =>
  first?.x === second?.x &&
  first?.y === second?.y &&
  first?.width === second?.width &&
  first?.height === second?.height;
