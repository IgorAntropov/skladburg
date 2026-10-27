import { useState } from 'react';

import { useHudPanelsStore } from './useHudPanelsStore';

interface CollapseSignalStateValue {
  isPrevCollapsed: boolean;
  seenStoreSignal: number;
  signal: number;
}

export const useHudPanelsCollapseSignal = (canCollapse: boolean): number => {
  const storeSignal = useHudPanelsStore(state => state.collapseSignal);
  const isStoreCollapsed = useHudPanelsStore(state => state.isCollapsed);
  const isCollapsed = isStoreCollapsed && canCollapse;
  const [state, setState] = useState<CollapseSignalStateValue>(() => ({
    isPrevCollapsed: isCollapsed,
    seenStoreSignal: storeSignal,
    signal: 0,
  }));

  const hasStoreSignalChanged = storeSignal !== state.seenStoreSignal;
  const isStoreSignalRaised = canCollapse && hasStoreSignalChanged;
  const isCollapseStarted = isCollapsed && !state.isPrevCollapsed;
  const isStateStale = hasStoreSignalChanged || isCollapseStarted || isCollapsed !== state.isPrevCollapsed;

  if (isStateStale) {
    setState({
      isPrevCollapsed: isCollapsed,
      seenStoreSignal: storeSignal,
      signal: isStoreSignalRaised || isCollapseStarted ? state.signal + 1 : state.signal,
    });
  }

  return state.signal;
};
