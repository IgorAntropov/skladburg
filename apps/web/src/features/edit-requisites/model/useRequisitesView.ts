import { useCallback } from 'react';

import { useActingContext } from '@/shared/api';

import { useRequisitesViewStore } from './useRequisitesViewStore';

export interface RequisitesViewValue {
  close: () => void;
  isOpen: boolean;
  open: () => void;
}

export const useRequisitesView = (): RequisitesViewValue => {
  const { organizationId } = useActingContext();
  const requestedFor = useRequisitesViewStore(state => state.requestedFor);
  const setRequestedFor = useRequisitesViewStore(state => state.setRequestedFor);

  const isOpen = organizationId !== undefined && requestedFor === organizationId;

  const open = useCallback((): void => {
    console.log('> useRequisitesView -> open:', { organizationId });

    if (organizationId !== undefined) {
      setRequestedFor(organizationId);
    }
  }, [organizationId, setRequestedFor]);

  const close = useCallback((): void => {
    console.log('> useRequisitesView -> close:', {});
    setRequestedFor(undefined);
  }, [setRequestedFor]);

  return { close, isOpen, open };
};
