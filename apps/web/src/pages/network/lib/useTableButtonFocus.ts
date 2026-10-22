import type { RefCallback } from 'react';

import {
  useCallback,
  useEffect,
  useRef,
} from 'react';

import { useFocusHandoff } from '@/shared/ui';

import { ORGANIZATION_DIRECTORY_TABLE_FOCUS_KEY } from '../model/organizationDirectoryTableFocusKey';

export const useTableButtonFocus = (isTableOpen: boolean): RefCallback<HTMLButtonElement> => {
  const { cancelFocus, ref: handoffRef } = useFocusHandoff<HTMLButtonElement>(ORGANIZATION_DIRECTORY_TABLE_FOCUS_KEY);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const wasTableOpenRef = useRef(isTableOpen);

  const setButtonRef = useCallback<RefCallback<HTMLButtonElement>>((element) => {
    buttonRef.current = element;
    handoffRef(element);
  }, [handoffRef]);

  useEffect(() => {
    if (wasTableOpenRef.current && !isTableOpen) {
      buttonRef.current?.focus();
      cancelFocus();
    }
    wasTableOpenRef.current = isTableOpen;
  }, [cancelFocus, isTableOpen]);

  return setButtonRef;
};
