import { create } from 'zustand';

interface RequisitesViewState {
  requestedFor: string | undefined;
  setRequestedFor: (organizationId: string | undefined) => void;
}

export const useRequisitesViewStore = create<RequisitesViewState>()(set => ({
  requestedFor: undefined,
  setRequestedFor: (organizationId) => {
    set(state => (state.requestedFor === organizationId ? state : { requestedFor: organizationId }));
  },
}));
