import type { UseMutationResult } from '@tanstack/react-query';

import { useMutation } from '@tanstack/react-query';

import { useDemoControl } from '@/shared/api';

export const RESET_DEMO_MUTATION_KEY = ['demo', 'reset'] as const;

export const useResetDemoMutation = (): UseMutationResult<void, Error, void> => {
  const demoControl = useDemoControl();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      if (demoControl === undefined) {
        throw new Error('Demo control is not available');
      }

      await demoControl.reset();
    },
    mutationKey: RESET_DEMO_MUTATION_KEY,
    retry: false,
  });
};
