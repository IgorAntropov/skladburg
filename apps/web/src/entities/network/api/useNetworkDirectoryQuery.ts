import type { UseQueryResult } from '@tanstack/react-query';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useApiClient } from '@/shared/api';

import type { NetworkDirectoryValue } from '../model/networkMapTypes';

import { createNetworkDirectoryQueryOptions } from './networkDirectoryQueryOptions';
import { networkKeys } from './networkKeys';

type NetworkDirectoryQueryKeyValue = ReturnType<typeof networkKeys.directory>;

export const useNetworkDirectoryQuery = <TData = NetworkDirectoryValue>(
  select?: (directory: NetworkDirectoryValue) => TData,
): UseQueryResult<TData> => {
  const client = useApiClient();

  const options = useMemo(() => createNetworkDirectoryQueryOptions(client), [client]);

  return useQuery<NetworkDirectoryValue, Error, TData, NetworkDirectoryQueryKeyValue>({ ...options, select });
};
