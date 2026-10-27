import type { RefObject } from 'react';

import { useEffect } from 'react';

import type { NotificationCloseReasonValue } from './notificationCloseReason';

export interface NotificationDismissOptionsValue {
  anchorRef: RefObject<HTMLElement | null>;
  onDismiss: (reason: NotificationCloseReasonValue) => void;
}

const isInsideAnchor = (anchor: HTMLElement | null, target: EventTarget | null): boolean => {
  return anchor !== null && target instanceof Node && anchor.contains(target);
};

export const useNotificationDismiss = ({ anchorRef, onDismiss }: NotificationDismissOptionsValue): void => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented) {
        return;
      }
      console.log('> useNotificationDismiss -> handleKeyDown:', { key: event.key });
      onDismiss('escape');
    };

    const handleOutsideEvent = (event: Event): void => {
      if (isInsideAnchor(anchorRef.current, event.target)) {
        return;
      }
      console.log('> useNotificationDismiss -> handleOutsideEvent:', { type: event.type });
      onDismiss('outside');
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handleOutsideEvent);
    document.addEventListener('focusin', handleOutsideEvent);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handleOutsideEvent);
      document.removeEventListener('focusin', handleOutsideEvent);
    };
  }, [anchorRef, onDismiss]);
};
