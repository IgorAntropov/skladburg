import type { RefObject } from 'react';

import { useEffect } from 'react';

import { useViewportClass } from '@/shared/lib/viewport';

const VIEWPORT_VARIABLE_NAME = '--global-search-viewport';

export const useViewportHeightVariable = (targetRef: RefObject<HTMLElement | null>): void => {
  const isPhone = useViewportClass() === 'phone';

  useEffect(() => {
    const target = targetRef.current;
    const viewport = window.visualViewport ?? undefined;

    if (!isPhone || target === null || viewport === undefined) {
      return undefined;
    }

    const writeHeight = (): void => {
      target.style.setProperty(VIEWPORT_VARIABLE_NAME, `${String(viewport.height)}px`);
    };

    writeHeight();
    viewport.addEventListener('resize', writeHeight);
    viewport.addEventListener('scroll', writeHeight);

    return () => {
      viewport.removeEventListener('resize', writeHeight);
      viewport.removeEventListener('scroll', writeHeight);
      target.style.removeProperty(VIEWPORT_VARIABLE_NAME);
    };
  }, [isPhone, targetRef]);
};
