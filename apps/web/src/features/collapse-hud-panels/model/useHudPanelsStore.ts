import { create } from 'zustand';

interface HudPanelsState {
  collapseSignal: number;
  collapsibleCount: number;
  isCollapsed: boolean;
  registerCollapsible: () => () => void;
  savedScrollY: number;
  toggleCollapsed: () => void;
}

export const useHudPanelsStore = create<HudPanelsState>()(set => ({
  collapseSignal: 0,
  collapsibleCount: 0,
  isCollapsed: false,
  registerCollapsible: () => {
    let isRegistered = true;

    set(state => ({ collapsibleCount: state.collapsibleCount + 1 }));

    return () => {
      if (!isRegistered) {
        return;
      }

      isRegistered = false;
      set(state => ({ collapsibleCount: state.collapsibleCount - 1 }));
    };
  },
  savedScrollY: 0,
  toggleCollapsed: () => {
    set(state => (
      state.isCollapsed
        ? { isCollapsed: false }
        : { collapseSignal: state.collapseSignal + 1, isCollapsed: true, savedScrollY: window.scrollY }
    ));
  },
}));
