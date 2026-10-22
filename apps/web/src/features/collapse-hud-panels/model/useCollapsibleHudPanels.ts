import {
  useLayoutEffect,
  useRef,
} from 'react';

import { useHudPanelsStore } from './useHudPanelsStore';

export const useCollapsibleHudPanels = (canCollapse: boolean): boolean => {
  const isCollapsed = useHudPanelsStore(state => state.isCollapsed);
  const registerCollapsible = useHudPanelsStore(state => state.registerCollapsible);
  const isEffectivelyCollapsed = isCollapsed && canCollapse;
  const wasEffectivelyCollapsedRef = useRef(isEffectivelyCollapsed);

  useLayoutEffect(() => {
    if (!canCollapse) {
      return undefined;
    }

    return registerCollapsible();
  }, [canCollapse, registerCollapsible]);

  useLayoutEffect(() => {
    const wasEffectivelyCollapsed = wasEffectivelyCollapsedRef.current;
    wasEffectivelyCollapsedRef.current = isEffectivelyCollapsed;

    const isRevealed = wasEffectivelyCollapsed && !isCollapsed;
    const { savedScrollY } = useHudPanelsStore.getState();

    if (isRevealed && savedScrollY > 0) {
      window.scrollTo(0, savedScrollY);
    }
  }, [isCollapsed, isEffectivelyCollapsed]);

  return isEffectivelyCollapsed;
};
