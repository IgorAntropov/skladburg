import type { RefObject } from 'react';

import { useEffect } from 'react';

import {
  isEditableTarget,
  isInsideOverlay,
} from '@/shared/lib/keyboard';

const isSlashKey = (event: KeyboardEvent): boolean => {
  return event.key === '/' || (event.code === 'Slash' && !event.shiftKey);
};

export const useSlashHotkey = (target: RefObject<HTMLInputElement | null>, onActivate?: (() => void)): void => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const isModified = event.ctrlKey || event.metaKey || event.altKey;

      if (!isSlashKey(event) || isModified || event.isComposing || event.defaultPrevented) {
        return;
      }

      if (isEditableTarget(event.target) || isInsideOverlay(event.target)) {
        return;
      }

      console.log('> useSlashHotkey -> handleKeyDown:', { code: event.code, key: event.key });
      event.preventDefault();
      target.current?.focus();
      onActivate?.();
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onActivate, target]);
};
