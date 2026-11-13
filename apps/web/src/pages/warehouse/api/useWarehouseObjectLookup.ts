import type { Warehouse } from '@skladburg/contracts/organization/v1/organization';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { useQueries } from '@tanstack/react-query';

import type { ObjectRefValue } from '@/shared/routing';

import {
  isPermissionGranted,
  useSessionQuery,
} from '@/entities/session';
import {
  isReadAccessDenied,
  useActingContext,
  useApiClient,
} from '@/shared/api';

import { getWarehouseCells } from '../model/warehouseCells';
import { warehouseWorkspaceQueries } from './warehouseWorkspaceQueries';

interface WarehouseObjectLookupValue {
  error: Error | null;
  isPending: boolean;
  refetch: () => void;
  warehouseId: string | undefined;
}

export const useWarehouseObjectLookup = (
  focus: ObjectRefValue | undefined,
  warehouses: readonly Warehouse[] | undefined,
): WarehouseObjectLookupValue => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();
  const isCell = focus?.type === 'cell';
  const isHandlingUnit = focus?.type === 'handling_unit';
  const isLookup = isCell || isHandlingUnit;
  const { data: session, error, isPending, refetch: refetchSession } = useSessionQuery({ isEnabled: isLookup });
  const permissions = session?.permissions ?? [];
  const permittedWarehouses = isLookup
    ? (warehouses ?? []).filter(({ id }) =>
        isPermissionGranted(permissions, isCell ? PermissionCode.WAREHOUSE_VIEW : PermissionCode.INVENTORY_VIEW, {
          kind: 'warehouse',
          warehouseId: id,
        }))
    : [];
  const topology = useQueries({
    queries: isCell
      ? permittedWarehouses.map(({ id: warehouseId }) =>
          warehouseWorkspaceQueries.topology(client, { organizationId, userId, warehouseId }, true))
      : [],
  });
  const stock = useQueries({
    queries: isHandlingUnit
      ? permittedWarehouses.map(({ id: warehouseId }) => warehouseWorkspaceQueries.balances(client, { organizationId, userId, warehouseId },
          true, true))
      : [],
  });
  const queries = isCell ? topology : stock;
  const refetch = (): void => {
    if (isLookup) {
      void refetchSession();
      for (const query of queries) {
        void query.refetch();
      }
    }
  };
  if (!isLookup) {
    return { error: null, isPending: false, refetch, warehouseId: undefined };
  }

  const index = isCell
    ? topology.findIndex(query => query.error === null && getWarehouseCells(query.data).some(cell => cell.id === focus.id))
    : stock.findIndex(query => query.error === null && query.data?.some(balance => balance.handlingUnit?.id === focus.id) === true);
  const matchedWarehouse = permittedWarehouses[index];
  if (matchedWarehouse !== undefined) {
    return { error: null, isPending: false, refetch, warehouseId: matchedWarehouse.id };
  }

  return {
    error: error ?? queries.find(query => query.error !== null && !isReadAccessDenied(query.error))?.error ?? null,
    isPending: isPending || warehouses === undefined || queries.some(query => query.isPending),
    refetch,
    warehouseId: undefined,
  };
};
