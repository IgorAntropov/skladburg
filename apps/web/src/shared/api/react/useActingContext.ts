import { useSyncExternalStore } from 'react';

import type { ActingContextValue } from '../context/actingContextTypes';

import { useApiRuntime } from './useApiRuntime';

export const useActingContext = (): ActingContextValue => {
  const { actingContext } = useApiRuntime();

  return useSyncExternalStore(actingContext.subscribe, actingContext.get);
};
