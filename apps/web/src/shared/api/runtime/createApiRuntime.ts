import type {
  ApiRuntimeValue,
  CreateApiRuntimeOptionsValue,
} from './apiRuntimeTypes';

import { createDemoRuntime } from './createDemoRuntime';
import { createPilotRuntime } from './createPilotRuntime';

export const createApiRuntime = async (options: CreateApiRuntimeOptionsValue): Promise<ApiRuntimeValue> => {
  if (import.meta.env.VITE_API_TRANSPORT === 'connect') {
    return createPilotRuntime(options);
  }

  return createDemoRuntime(options);
};
