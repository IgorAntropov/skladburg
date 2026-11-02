import type { UseQueryResult } from '@tanstack/react-query';

import { userChannel } from '@skladburg/contracts/runtime';
import {
  skipToken,
  useQuery,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import type {
  ApiQueryMetaValue,
  DemoPersonaListItemValue,
  RealtimeEventCaseValue,
} from '@/shared/api';

import {
  useActingContext,
  useDemoControl,
} from '@/shared/api';

import { personaKeys } from './personaKeys';

const NO_CHANNELS_META: ApiQueryMetaValue = { channels: [] };

const PERSONA_EVENT_CASES: readonly RealtimeEventCaseValue[] = ['userChanged'];

export const usePersonasQuery = (): UseQueryResult<readonly DemoPersonaListItemValue[]> => {
  const demoControl = useDemoControl();
  const { userId } = useActingContext();

  const meta = useMemo(
    (): ApiQueryMetaValue => userId === undefined
      ? NO_CHANNELS_META
      : { channels: [userChannel(userId)], eventCases: PERSONA_EVENT_CASES },
    [userId],
  );

  return useQuery({
    meta,
    queryFn: demoControl === undefined
      ? skipToken
      : (): Promise<readonly DemoPersonaListItemValue[]> => demoControl.listPersonas(),
    queryKey: personaKeys.list,
  });
};
