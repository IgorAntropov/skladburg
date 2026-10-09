import { useIsMutating } from '@tanstack/react-query';

import { RESET_DEMO_MUTATION_KEY } from './useResetDemoMutation';

export const useIsDemoResetPending = (): boolean => useIsMutating({ mutationKey: RESET_DEMO_MUTATION_KEY }) > 0;
