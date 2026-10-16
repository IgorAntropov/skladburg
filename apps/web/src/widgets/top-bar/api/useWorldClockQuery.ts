import type { UseQueryResult } from '@tanstack/react-query';

import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '@/shared/api';

import type { WorldClockReadingValue } from '../lib/worldClockTypes';

import { createWorldClockQueryOptions } from './worldClockQueryOptions';

export const useWorldClockQuery = (): UseQueryResult<WorldClockReadingValue> => {
  const client = useApiClient();

  return useQuery(createWorldClockQueryOptions(client));
};
