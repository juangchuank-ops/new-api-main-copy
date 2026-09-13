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

import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@douyinfe/semi-ui';
import { IconClose } from '@douyinfe/semi-icons';

import { clampFloatingWindowRect } from './geometry';
import { FloatingWindowContent } from './contentRegistry';

const FloatingWindowFrame = ({
  descriptor,
  viewport,
  onActivate,
  onClose,
  onRectChange,
}) => {
  const { t } = useTranslation();
  const dragRef = useRef(null);
  const titleId = `floating-window-title-${descriptor.instanceId}`;
  const rect = viewport
    ? clampFloatingWindowRect(descriptor.rect, viewport)
    : descriptor.rect;

  const endInteraction = (event) => {
    if (dragRef.current && dragRef.current.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !viewport) {
      return;
    }

    const nextRect = {
      ...drag.rect,
      x: drag.rect.x + (event.clientX - drag.startX),
      y: drag.rect.y + (event.clientY - drag.startY),
    };

    onRectChange(
      descriptor.instanceId,
      clampFloatingWindowRect(nextRect, viewport),
    );
  };

  const startDrag = (event) => {
    if (!viewport || event.button !== 0 || !event.isPrimary) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      rect: { ...rect },
    };
  };

  return (
    <section
      role='dialog'
      aria-modal={false}
      aria-labelledby={titleId}
      tabIndex={-1}
      onPointerDown={() => onActivate(descriptor.instanceId)}
      onPointerMove={handlePointerMove}
      onPointerUp={endInteraction}
      onPointerCancel={endInteraction}
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        zIndex: descriptor.order,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--semi-color-bg-2)',
        color: 'var(--semi-color-text-0)',
        border: '1px solid var(--semi-color-border)',
        borderRadius: '6px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.24)',
      }}
    >
      <header
        onPointerDown={startDrag}
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          cursor: 'move',
          touchAction: 'none',
          userSelect: 'none',
          borderBottom: '1px solid var(--semi-color-border)',
          background: 'var(--semi-color-fill-0)',
        }}
      >
        <h2
          id={titleId}
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            margin: 0,
            fontSize: '14px',
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {t(descriptor.title)}
        </h2>
        <span
          style={{ flex: '0 0 auto', display: 'inline-flex' }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Button
            size='small'
            theme='borderless'
            type='tertiary'
            icon={<IconClose />}
            aria-label={t('关闭')}
            onClick={() => onClose(descriptor.instanceId)}
          />
        </span>
      </header>

      <div
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          minWidth: 0,
          overflow: 'auto',
        }}
      >
        <FloatingWindowContent
          descriptor={descriptor}
          requestClose={() => onClose(descriptor.instanceId)}
        />
      </div>
    </section>
  );
};

export default FloatingWindowFrame;
