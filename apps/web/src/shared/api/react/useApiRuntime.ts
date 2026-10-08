import { useContext } from 'react';

import type { ApiRuntimeValue } from '../runtime/apiRuntimeTypes';

import { ApiRuntimeContext } from './ApiRuntimeContext';

export const useApiRuntime = (): ApiRuntimeValue => {
  const runtime = useContext(ApiRuntimeContext);

  if (runtime === undefined) {
    throw new Error('API hooks must be used inside ApiRuntimeProvider');
  }

  return runtime;
};
