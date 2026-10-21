import { create } from 'zustand';

import type { NetworkFocusRequestValue } from './networkSceneInteraction';

interface NetworkMapStoreValue {
  clearHoveredId: (id: string) => void;
  focusRequest: NetworkFocusRequestValue | undefined;
  hoveredId: string | undefined;
  requestFocus: (id: string) => void;
  setHoveredId: (id: string) => void;
}

export const useNetworkMapStore = create<NetworkMapStoreValue>()(set => ({
  clearHoveredId: (id) => { set(current => (current.hoveredId === id ? { hoveredId: undefined } : current)); },
  focusRequest: undefined,
  hoveredId: undefined,
  requestFocus: (id) => { set(current => ({ focusRequest: { id, sequence: (current.focusRequest?.sequence ?? 0) + 1 } })); },
  setHoveredId: (id) => { set({ hoveredId: id }); },
}));
