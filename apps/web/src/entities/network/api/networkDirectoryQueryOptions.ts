import type { UndefinedInitialDataOptions } from '@tanstack/react-query';

import { queryOptions } from '@tanstack/react-query';

import type { ApiClient } from '@/shared/api';

import type { NetworkDirectoryValue } from '../model/networkMapTypes';

import { fetchNetworkDirectory } from './fetchNetworkDirectory';
import { networkKeys } from './networkKeys';

type NetworkDirectoryQueryKeyValue = ReturnType<typeof networkKeys.directory>;

export const createNetworkDirectoryQueryOptions = (
  client: ApiClient,
): UndefinedInitialDataOptions<NetworkDirectoryValue, Error, NetworkDirectoryValue, NetworkDirectoryQueryKeyValue> => queryOptions({
  meta: { channels: [] },
  queryFn: (): Promise<NetworkDirectoryValue> => fetchNetworkDirectory(client),
  queryKey: networkKeys.directory(),
  staleTime: Infinity,
});
