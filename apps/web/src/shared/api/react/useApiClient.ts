import type { ApiClient } from '../client/apiClientTypes';

import { useApiRuntime } from './useApiRuntime';

export const useApiClient = (): ApiClient => {
  return useApiRuntime().client;
};
