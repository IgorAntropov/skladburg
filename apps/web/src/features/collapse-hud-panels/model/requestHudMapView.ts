import { useHudPanelsStore } from './useHudPanelsStore';

export const requestHudMapView = (currentScrollY: number): void => {
  useHudPanelsStore.setState((state) => {
    if (state.collapsibleCount === 0) {
      return state;
    }

    return {
      collapseSignal: state.collapseSignal + 1,
      isCollapsed: true,
      savedScrollY: state.isCollapsed ? state.savedScrollY : currentScrollY,
    };
  });
};
