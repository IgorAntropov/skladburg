import { useHudPanelsStore } from './useHudPanelsStore';

export const resetHudPanelsStore = (): void => {
  useHudPanelsStore.setState({ collapsibleCount: 0, isCollapsed: false, savedScrollY: 0 });
};
