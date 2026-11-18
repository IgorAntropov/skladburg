import { useContext } from 'react';

import type { IRealtimeChannel } from '../realtime/realtimeTypes';
import type { ApiRuntimeValue } from '../runtime/apiRuntimeTypes';

import { ApiRuntimeContext } from './ApiRuntimeContext';

export const useApiRuntime = (): ApiRuntimeValue => {
  const runtime = useContext(ApiRuntimeContext);

  if (runtime === undefined) {
    throw new Error('API hooks must be used inside ApiRuntimeProvider');
  }

  return runtime;
};

export const useRealtimeChannel = (): IRealtimeChannel => useApiRuntime().realtime;
