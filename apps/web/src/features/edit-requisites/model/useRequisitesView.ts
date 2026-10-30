import {
  useCallback,
  useSyncExternalStore,
} from 'react';

import { useActingContext } from '@/shared/api';

export interface RequisitesViewValue {
  close: () => void;
  isOpen: boolean;
  open: () => void;
}

const listeners = new Set<() => void>();

let requestedFor: string | undefined;

const setRequestedFor = (organizationId: string | undefined): void => {
  if (requestedFor === organizationId) {
    return;
  }

  requestedFor = organizationId;

  for (const listener of listeners) {
    listener();
  }
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);

  return (): void => {
    listeners.delete(listener);
  };
};

const getRequestedFor = (): string | undefined => requestedFor;

export const useRequisitesView = (): RequisitesViewValue => {
  const { organizationId } = useActingContext();
  const currentRequestedFor = useSyncExternalStore(subscribe, getRequestedFor);

  const isOpen = organizationId !== undefined && currentRequestedFor === organizationId;

  const open = useCallback((): void => {
    console.log('> useRequisitesView -> open:', { organizationId });

    if (organizationId !== undefined) {
      setRequestedFor(organizationId);
    }
  }, [organizationId]);

  const close = useCallback((): void => {
    console.log('> useRequisitesView -> close:', {});
    setRequestedFor(undefined);
  }, []);

  return { close, isOpen, open };
};
