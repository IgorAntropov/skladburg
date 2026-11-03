import { useMemo } from 'react';

import { useActingContext } from '@/shared/api';

import type { DestinationOptionValue } from '../lib/destinationOptions';

import { resolveDestination } from '../lib/destinationOptions';
import { useCatalogDestinationStore } from '../model/useCatalogDestinationStore';
import { useOwnWarehouseOptions } from './useOwnWarehouseOptions';

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

export const useShowcaseDestination = (): ShowcaseDestinationStateValue => {
  const { organizationId } = useActingContext();
  const warehouseOptions = useOwnWarehouseOptions();

  const savedWarehouseId = useCatalogDestinationStore(
    state => (organizationId === undefined ? undefined : state.warehouseIdByOrganization[organizationId]),
  );
  const selectWarehouse = useCatalogDestinationStore(state => state.selectWarehouse);

  const { options } = warehouseOptions;

  const destination = useMemo(() => resolveDestination(options, savedWarehouseId), [options, savedWarehouseId]);

  const select = (warehouseId: string): void => {
    console.log('> useShowcaseDestination -> select:', { warehouseId });
    if (organizationId !== undefined) {
      selectWarehouse(organizationId, warehouseId);
    }
  };

  return { ...warehouseOptions, destination, select };
};
