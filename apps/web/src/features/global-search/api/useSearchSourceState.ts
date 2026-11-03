import type { UseQueryResult } from '@tanstack/react-query';

import { useMemo } from 'react';

import type { SearchSourceStateValue } from '../model/searchSourceTypes';

import { toSearchSourceState } from '../lib/toSearchSourceState';

export const useSearchSourceState = <TData>(
  result: UseQueryResult<TData>,
  isAvailable: boolean,
): SearchSourceStateValue<TData> | undefined => {
  const { data, error, isError, isPlaceholderData, refetch } = result;

  return useMemo(
    () => (isAvailable ? toSearchSourceState({ data, error, isError, isPlaceholderData, refetch }) : undefined),
    [data, error, isAvailable, isError, isPlaceholderData, refetch],
  );
};
