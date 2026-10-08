import type { UseQueryResult } from '@tanstack/react-query';

import {
  skipToken,
  useQuery,
} from '@tanstack/react-query';

import type { DemoPersonaListItemValue } from '@/shared/api';

import { useDemoControl } from '@/shared/api';

import { personaKeys } from './personaKeys';

export const usePersonasQuery = (): UseQueryResult<readonly DemoPersonaListItemValue[]> => {
  const demoControl = useDemoControl();

  return useQuery({
    queryFn: demoControl === undefined
      ? skipToken
      : (): Promise<readonly DemoPersonaListItemValue[]> => demoControl.listPersonas(),
    queryKey: personaKeys.list,
  });
};
