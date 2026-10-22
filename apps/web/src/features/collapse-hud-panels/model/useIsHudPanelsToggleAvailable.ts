import { useHudPanelsStore } from './useHudPanelsStore';

export const useIsHudPanelsToggleAvailable = (): boolean => {
  return useHudPanelsStore(state => state.collapsibleCount > 0);
};
