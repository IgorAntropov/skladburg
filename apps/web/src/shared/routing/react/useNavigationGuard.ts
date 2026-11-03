import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { AppAddressValue } from '../address/addressTypes';
import type { ShouldBlockValue } from '../location/locationTypes';

import { parseAddressPath } from '../address/parseAddressPath';
import { toPathOnly } from '../location/isSamePath';
import { useLocationSource } from './useLocationSource';

export interface NavigationGuardValue {
  cancelLeave: () => void;
  confirmLeave: () => void;
  isLeavePending: boolean;
  requestLeave: (action: () => void) => void;
}

export type ShouldGuardValue = (next: AppAddressValue | undefined) => boolean;

interface PendingLeaveValue {
  action: () => void;
}

export const useNavigationGuard = (isDirty: boolean, shouldGuard?: ShouldGuardValue): NavigationGuardValue => {
  const location = useLocationSource();
  const unblockRef = useRef<(() => void) | undefined>(undefined);
  const shouldGuardRef = useRef(shouldGuard);
  const [pendingLeave, setPendingLeave] = useState<PendingLeaveValue | undefined>(undefined);
  const [armCount, setArmCount] = useState(0);

  const isLeavePending = isDirty && pendingLeave !== undefined;

  const requestLeave = useCallback((action: () => void): void => {
    console.log('> useNavigationGuard -> requestLeave:', { isDirty });

    if (!isDirty) {
      action();

      return;
    }

    setPendingLeave({ action });
  }, [isDirty]);

  const confirmLeave = useCallback((): void => {
    console.log('> useNavigationGuard -> confirmLeave:', { hasQuestion: pendingLeave !== undefined });

    if (pendingLeave === undefined) {
      return;
    }

    unblockRef.current?.();
    setPendingLeave(undefined);
    setArmCount(current => current + 1);
    pendingLeave.action();
  }, [pendingLeave]);

  const cancelLeave = useCallback((): void => {
    console.log('> useNavigationGuard -> cancelLeave:', {});
    setPendingLeave(undefined);
  }, []);

  useEffect(() => {
    if (!isDirty) {
      return undefined;
    }

    const handleBlocked = (proceed: (() => void) | undefined): void => {
      console.log('> useNavigationGuard -> handleBlocked:', { isAsking: proceed !== undefined });
      setPendingLeave(proceed === undefined ? undefined : { action: proceed });
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      Reflect.set(event, 'returnValue', true);
    };

    const shouldBlock: ShouldBlockValue = (nextPath) => {
      const currentShouldGuard = shouldGuardRef.current;

      return currentShouldGuard === undefined || currentShouldGuard(parseAddressPath(toPathOnly(nextPath)));
    };

    const unblock = location.block(handleBlocked, shouldBlock);

    unblockRef.current = unblock;
    window.addEventListener('beforeunload', handleBeforeUnload);

    return (): void => {
      unblock();
      unblockRef.current = undefined;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      setPendingLeave(undefined);
    };
  }, [armCount, isDirty, location]);

  useEffect(() => {
    shouldGuardRef.current = shouldGuard;
  }, [shouldGuard]);

  return { cancelLeave, confirmLeave, isLeavePending, requestLeave };
};
