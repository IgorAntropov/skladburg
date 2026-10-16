import type { UndefinedInitialDataOptions } from '@tanstack/react-query';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import { queryOptions } from '@tanstack/react-query';

import type { ApiClient } from '@/shared/api';

import type { WorldClockReadingValue } from '../lib/worldClockTypes';

import { worldClockKeys } from './worldClockKeys';

const WORLD_CLOCK_STALE_TIME_MS = 5 * 60_000;

type WorldClockQueryKeyValue = ReturnType<typeof worldClockKeys.current>;

export const createWorldClockQueryOptions = (
  client: ApiClient,
): UndefinedInitialDataOptions<WorldClockReadingValue, Error, WorldClockReadingValue, WorldClockQueryKeyValue> => queryOptions({
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
