import type { IDemoControl } from '../transport/demo';

import { useApiRuntime } from './useApiRuntime';

export const useDemoControl = (): IDemoControl | undefined => {
  return useApiRuntime().demoControl;
};
