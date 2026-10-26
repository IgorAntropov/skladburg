import { useHudPanelsStore } from './useHudPanelsStore';

export const useHudPanelsCollapseSignal = (): number => useHudPanelsStore(state => state.collapseSignal);
