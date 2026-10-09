import type {
  ReactElement,
  ReactNode,
} from 'react';

import {
  useMemo,
  useRef,
} from 'react';

import type { IFocusHandoff } from './FocusHandoffContext';

import { FocusHandoffContext } from './FocusHandoffContext';

export const FocusHandoffProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const requestedKeyRef = useRef<string | undefined>(undefined);

  const handoff = useMemo<IFocusHandoff>(() => ({
    cancel: (key) => {
      if (requestedKeyRef.current !== key) {
        return;
      }
      console.log('> FocusHandoffProvider -> cancel:', { key });
      requestedKeyRef.current = undefined;
    },
    claim: (key) => {
      if (requestedKeyRef.current !== key) {
        return false;
      }
      requestedKeyRef.current = undefined;

      return true;
    },
    request: (key) => {
      console.log('> FocusHandoffProvider -> request:', { key });
      requestedKeyRef.current = key;
    },
  }), []);

  return <FocusHandoffContext value={handoff}>{children}</FocusHandoffContext>;
};
