import { create } from 'zustand';

export interface NetworkMapFocusCommandValue {
  id: string;
  isOrganization: boolean;
  sequence: number;
}

interface NetworkMapStoreValue {
  clearHoveredId: (id: string) => void;
  clearHoveredOrganizationId: (id: string) => void;
  focusCommand: NetworkMapFocusCommandValue | undefined;
  hoveredId: string | undefined;
  hoveredOrganizationId: string | undefined;
  requestFocus: (id: string) => void;
  requestOrganizationFocus: (organizationId: string) => void;
  setHoveredId: (id: string) => void;
  setHoveredOrganizationId: (id: string) => void;
}

const nextFocusCommand = (
  previous: NetworkMapFocusCommandValue | undefined,
  id: string,
  isOrganization: boolean,
): NetworkMapFocusCommandValue => ({ id, isOrganization, sequence: (previous?.sequence ?? 0) + 1 });

export const useNetworkMapStore = create<NetworkMapStoreValue>()(set => ({
  clearHoveredId: (id) => { set(current => (current.hoveredId === id ? { hoveredId: undefined } : current)); },
  clearHoveredOrganizationId: (id) => {
    set(current => (current.hoveredOrganizationId === id ? { hoveredOrganizationId: undefined } : current));
  },
  focusCommand: undefined,
  hoveredId: undefined,
  hoveredOrganizationId: undefined,
  requestFocus: (id) => { set(current => ({ focusCommand: nextFocusCommand(current.focusCommand, id, false) })); },
  requestOrganizationFocus: (organizationId) => {
    set(current => ({ focusCommand: nextFocusCommand(current.focusCommand, organizationId, true) }));
  },
  setHoveredId: (id) => { set({ hoveredId: id }); },
  setHoveredOrganizationId: (id) => { set({ hoveredOrganizationId: id }); },
}));
