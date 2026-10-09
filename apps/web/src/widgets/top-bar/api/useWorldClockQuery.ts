import type { UseQueryResult } from '@tanstack/react-query';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '@/shared/api';

import type { WorldClockReadingValue } from '../lib/worldClockTypes';

import { worldClockKeys } from './worldClockKeys';

const WORLD_CLOCK_STALE_TIME_MS = 5 * 60_000;

export const useWorldClockQuery = (): UseQueryResult<WorldClockReadingValue> => {
  const client = useApiClient();

  return useQuery({
    queryFn: async (): Promise<WorldClockReadingValue> => {
      const response = await client.clock.getWorldClock({});
      const receivedAtMs = performance.now();

      if (response.worldTime === undefined) {
        throw new Error('world_time_missing');
      }

      return {
        receivedAtMs,
        snapshot: { timeScale: response.timeScale, worldTimeMs: timestampMs(response.worldTime) },
      };
    },
    queryKey: worldClockKeys.current(),
    refetchOnWindowFocus: 'always',
    staleTime: WORLD_CLOCK_STALE_TIME_MS,
  });
};
