import type { CommandValue } from '@/shared/api';

import {
  useCommand,
  useDemoControl,
} from '@/shared/api';

export const RESET_DEMO_MUTATION_KEY = ['demo', 'reset'] as const;

interface UseResetDemoCommandOptionsValue {
  onSuccess: () => void;
}

export const useResetDemoCommand = ({ onSuccess }: UseResetDemoCommandOptionsValue): CommandValue => {
  const demoControl = useDemoControl();

  return useCommand({
    execute: async (): Promise<void> => {
      if (demoControl === undefined) {
        throw new Error('Demo control is not available');
      }

      await demoControl.reset();
    },
    mutationKey: RESET_DEMO_MUTATION_KEY,
    onSuccess,
  });
};
