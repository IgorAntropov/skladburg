import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';

import { useMemo } from 'react';

import { useNetworkDirectoryQuery } from '@/entities/network';
import { useWarehousesQuery } from '@/entities/warehouse';
import { useActingContext } from '@/shared/api';

import type { DestinationOptionValue } from '../lib/destinationOptions';

import {
  buildDestinationOptions,
  resolveDestination,
} from '../lib/destinationOptions';
import { useCatalogDestinationStore } from '../model/useCatalogDestinationStore';

export interface ShowcaseDestinationStateValue {
  cityNames: ReadonlyMap<string, string>;
  destination: DestinationOptionValue | undefined;
  error: Error | null;
  isPending: boolean;
  isRetrying: boolean;
  options: readonly DestinationOptionValue[];
  retry: () => void;
  select: (warehouseId: string) => void;
}

const NO_WAREHOUSES: readonly Warehouse[] = [];

export const useShowcaseDestination = (): ShowcaseDestinationStateValue => {
  const { organizationId } = useActingContext();
  const warehousesQuery = useWarehousesQuery();
  const directoryQuery = useNetworkDirectoryQuery();
  const savedWarehouseId = useCatalogDestinationStore(
    state => (organizationId === undefined ? undefined : state.warehouseIdByOrganization[organizationId]),
  );
  const selectWarehouse = useCatalogDestinationStore(state => state.selectWarehouse);

  const warehouses = warehousesQuery.data ?? NO_WAREHOUSES;
  const cities = directoryQuery.data?.cities;

  const cityNames = useMemo(
    () => new Map((cities ?? []).map((city): [string, string] => [city.id, city.name])),
    [cities],
  );
  const options = useMemo(() => buildDestinationOptions(warehouses, cityNames), [cityNames, warehouses]);
  const destination = useMemo(() => resolveDestination(options, savedWarehouseId), [options, savedWarehouseId]);

  const error = warehousesQuery.error ?? directoryQuery.error;
  const isPending = error === null && (warehousesQuery.data === undefined || directoryQuery.data === undefined);

  const select = (warehouseId: string): void => {
    console.log('> useShowcaseDestination -> select:', { warehouseId });

    if (organizationId !== undefined) {
      selectWarehouse(organizationId, warehouseId);
    }
  };

  const retry = (): void => {
    console.log('> useShowcaseDestination -> retry:', {});

    if (warehousesQuery.error !== null) {
      void warehousesQuery.refetch();
    }

    if (directoryQuery.error !== null) {
      void directoryQuery.refetch();
    }
  };

  return {
    cityNames,
    destination,
    error,
    isPending,
    isRetrying: warehousesQuery.isFetching || directoryQuery.isFetching,
    options,
    retry,
    select,
  };
};
