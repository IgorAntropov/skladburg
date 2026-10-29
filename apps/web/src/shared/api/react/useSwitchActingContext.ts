import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useRef,
  useState,
} from 'react';

import type { ActingContextValue } from '../context/actingContextTypes';

import { replaceActingContext } from '../query/replaceActingContext';
import { useApiRuntime } from './useApiRuntime';

export interface SwitchActingContextResultValue {
  isSwitching: boolean;
  switchActingContext: (context: ActingContextValue) => Promise<void>;
}

export const useSwitchActingContext = (): SwitchActingContextResultValue => {
  const { actingContext, errorJournal } = useApiRuntime();
  const queryClient = useQueryClient();
  const [isSwitching, setIsSwitching] = useState(false);
  const isSwitchingRef = useRef(false);

  const switchActingContext = useCallback(async (context: ActingContextValue): Promise<void> => {
    const current = actingContext.get();
    const isCurrentContext = context.organizationId === current.organizationId && context.userId === current.userId;

    if (isCurrentContext || isSwitchingRef.current) {
      return;
    }

    console.log('> useSwitchActingContext -> switchActingContext:', { from: current, to: context });

    isSwitchingRef.current = true;
    setIsSwitching(true);

    try {
      await replaceActingContext({
        actingContext,
        context,
        errorJournal,
        queryClient,
      });
    }
    finally {
      isSwitchingRef.current = false;
      setIsSwitching(false);
    }
  }, [actingContext, errorJournal, queryClient]);

  return { isSwitching, switchActingContext };
};
