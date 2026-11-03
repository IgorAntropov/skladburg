import type { RefObject } from 'react';

import { useEffect } from 'react';

export const useOutsideDismiss = (rootRef: RefObject<HTMLElement | null>, onDismiss: () => void): void => {
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent): void => {
      const root = rootRef.current;
      const { target } = event;

      if (root !== null && target instanceof Node && root.contains(target)) {
        return;
      }

      console.log('> useOutsideDismiss -> handlePointerDown:', {});
      onDismiss();
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onDismiss, rootRef]);
};
