import { useHudPanelsStore } from './useHudPanelsStore';

export const resetHudPanelsStore = (): void => {
  useHudPanelsStore.setState({ collapseSignal: 0, collapsibleCount: 0, isCollapsed: false, savedScrollY: 0 });
};
