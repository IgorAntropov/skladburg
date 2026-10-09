import type { RefCallback } from 'react';

import {
  use,
  useCallback,
  useMemo,
} from 'react';

import { FocusHandoffContext } from './FocusHandoffContext';

export interface FocusHandoffValue<TElement extends HTMLElement> {
  cancelFocus: () => void;
  ref: RefCallback<TElement>;
  requestFocus: () => void;
}

export const useFocusHandoff = <TElement extends HTMLElement>(key: string): FocusHandoffValue<TElement> => {
  const handoff = use(FocusHandoffContext);

  const ref = useCallback<RefCallback<TElement>>((element) => {
    if (element === null || !handoff.claim(key)) {
      return;
    }
    element.focus();
  }, [handoff, key]);

  const requestFocus = useCallback((): void => {
    handoff.request(key);
  }, [handoff, key]);

  const cancelFocus = useCallback((): void => {
    handoff.cancel(key);
  }, [handoff, key]);

  return useMemo(() => ({
    cancelFocus,
    ref,
    requestFocus,
  }), [cancelFocus, ref, requestFocus]);
};
