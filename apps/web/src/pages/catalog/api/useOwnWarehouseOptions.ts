import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';

import { useMemo } from 'react';

import { useNetworkDirectoryQuery } from '@/entities/network';
import { useWarehousesQuery } from '@/entities/warehouse';

import type { DestinationOptionValue } from '../lib/destinationOptions';

import { buildDestinationOptions } from '../lib/destinationOptions';

export interface OwnWarehouseOptionsValue {
  cityNames: ReadonlyMap<string, string>;
  error: Error | null;
  isPending: boolean;
  isRetrying: boolean;
  options: readonly DestinationOptionValue[];
  retry: () => void;
}

const NO_WAREHOUSES: readonly Warehouse[] = [];

export const useOwnWarehouseOptions = (): OwnWarehouseOptionsValue => {
  const warehousesQuery = useWarehousesQuery();
  const directoryQuery = useNetworkDirectoryQuery();

  const warehouses = warehousesQuery.data ?? NO_WAREHOUSES;
  const cities = directoryQuery.data?.cities;

  const cityNames = useMemo(
    () => new Map((cities ?? []).map((city): [string, string] => [city.id, city.name])),
    [cities],
  );
  const options = useMemo(() => buildDestinationOptions(warehouses, cityNames), [cityNames, warehouses]);

  const error = warehousesQuery.error ?? directoryQuery.error;
  const isPending = error === null && (warehousesQuery.data === undefined || directoryQuery.data === undefined);

  const retry = (): void => {
    console.log('> useOwnWarehouseOptions -> retry:', {});
    if (warehousesQuery.error !== null) {
      void warehousesQuery.refetch();
    }
    if (directoryQuery.error !== null) {
      void directoryQuery.refetch();
    }
  };

  return {
    cityNames,
    error,
    isPending,
    isRetrying: warehousesQuery.isFetching || directoryQuery.isFetching,
    options,
    retry,
  };
};
