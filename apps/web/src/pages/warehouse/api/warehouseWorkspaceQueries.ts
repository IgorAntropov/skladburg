import type { PickingTask } from '@skladburg/contracts/wms/v1/picking';
import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';
import type {
  StockBalance,
  StockMovement,
} from '@skladburg/contracts/wms/v1/stock';
import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';
import type { UseQueryOptions } from '@tanstack/react-query';

import {
  inventoryChannel,
  tasksChannel,
  warehouseChannel,
} from '@skladburg/contracts/runtime';
import { skipToken } from '@tanstack/react-query';

import type {
  ApiClient,
  RealtimeEventCaseValue,
} from '@/shared/api';

import { collectPages } from '@/shared/api';

import type { WarehouseWorkspaceScopeValue } from './warehouseWorkspaceKey';

import { warehouseWorkspaceKey } from './warehouseWorkspaceKey';

type WarehouseQueryKindValue = 'balances' | 'movements' | 'picking' | 'receiving' | 'topology';

interface WarehouseQueryResourceValue<TData> {
  channel: (warehouseId: string) => string;
  event: RealtimeEventCaseValue;
  kind: WarehouseQueryKindValue;
  read: WarehouseReadValue<TData>;
}

type WarehouseReadValue<TData> = (client: ApiClient, warehouseId: string, signal: AbortSignal) => Promise<TData>;

const createWarehouseQuery = <TData>(
  client: ApiClient,
  scope: WarehouseWorkspaceScopeValue,
  canView: boolean,
  isEnabled: boolean,
  resource: WarehouseQueryResourceValue<TData>,
): UseQueryOptions<TData> => {
  const { organizationId, userId, warehouseId } = scope;
  const { channel, event, kind, read } = resource;
  if (!canView || organizationId === undefined || userId === undefined || warehouseId === undefined) {
    return { queryFn: skipToken, queryKey: ['warehouse-workspace-disabled', kind] };
  }

  return {
    enabled: isEnabled,
    meta: { channels: [channel(warehouseId)], eventCases: [event] },
    queryFn: ({ signal }): Promise<TData> => read(client, warehouseId, signal),
    queryKey: [...warehouseWorkspaceKey(scope), kind],
  };
};

const topologyResource: WarehouseQueryResourceValue<null | WarehouseTopology> = {
  channel: warehouseChannel,
  event: 'warehouseChanged',
  kind: 'topology',
  read: async (client, warehouseId, signal) => {
    const { WarehouseTopologyService } = await import('@skladburg/contracts/wms/v1/topology');
    signal.throwIfAborted();
    const { topology } = await client.service(WarehouseTopologyService).getWarehouseTopology({ warehouseId }, { signal });
    return topology ?? null;
  },
};

const balancesResource: WarehouseQueryResourceValue<StockBalance[]> = {
  channel: inventoryChannel,
  event: 'stockChanged',
  kind: 'balances',
  read: async (client, warehouseId, signal) => {
    const { WarehouseStockService } = await import('@skladburg/contracts/wms/v1/stock');
    signal.throwIfAborted();
    const service = client.service(WarehouseStockService);

    return collectPages(async (page) => {
      signal.throwIfAborted();
      const response = await service.listStockBalances({ page, warehouseId }, { signal });
      return { items: response.balances, nextPageToken: response.page?.nextPageToken ?? '' };
    });
  },
};

const movementsResource: WarehouseQueryResourceValue<StockMovement[]> = {
  channel: inventoryChannel,
  event: 'stockChanged',
  kind: 'movements',
  read: async (client, warehouseId, signal) => {
    const { WarehouseStockService } = await import('@skladburg/contracts/wms/v1/stock');
    signal.throwIfAborted();
    const service = client.service(WarehouseStockService);

    return collectPages(async (page) => {
      signal.throwIfAborted();
      const response = await service.listStockMovements({ page, warehouseId }, { signal });
      return { items: response.movements, nextPageToken: response.page?.nextPageToken ?? '' };
    });
  },
};

const pickingResource: WarehouseQueryResourceValue<PickingTask[]> = {
  channel: tasksChannel,
  event: 'pickingTasksChanged',
  kind: 'picking',
  read: async (client, warehouseId, signal) => {
    const { WarehousePickingService } = await import('@skladburg/contracts/wms/v1/picking');
    signal.throwIfAborted();
    const service = client.service(WarehousePickingService);

    return collectPages(async (page) => {
      signal.throwIfAborted();
      const response = await service.listPickingTasks({ page, warehouseId }, { signal });
      return { items: response.tasks, nextPageToken: response.page?.nextPageToken ?? '' };
    });
  },
};

const receivingResource: WarehouseQueryResourceValue<ReceivingTask[]> = {
  channel: tasksChannel,
  event: 'receivingTasksChanged',
  kind: 'receiving',
  read: async (client, warehouseId, signal) => {
    const { WarehouseReceivingService } = await import('@skladburg/contracts/wms/v1/receiving');
    signal.throwIfAborted();
    const service = client.service(WarehouseReceivingService);

    return collectPages(async (page) => {
      signal.throwIfAborted();
      const response = await service.listReceivingTasks({ page, warehouseId }, { signal });
      return { items: response.tasks, nextPageToken: response.page?.nextPageToken ?? '' };
    });
  },
};

export const warehouseWorkspaceQueries = {
  balances: (
    client: ApiClient, scope: WarehouseWorkspaceScopeValue, canView: boolean, isEnabled: boolean,
  ): UseQueryOptions<StockBalance[]> => createWarehouseQuery(client, scope, canView, isEnabled, balancesResource),
  movements: (
    client: ApiClient, scope: WarehouseWorkspaceScopeValue, canView: boolean, isEnabled: boolean,
  ): UseQueryOptions<StockMovement[]> => createWarehouseQuery(client, scope, canView, isEnabled, movementsResource),
  picking: (
    client: ApiClient, scope: WarehouseWorkspaceScopeValue, canView: boolean, isEnabled: boolean,
  ): UseQueryOptions<PickingTask[]> => createWarehouseQuery(client, scope, canView, isEnabled, pickingResource),
  receiving: (
    client: ApiClient, scope: WarehouseWorkspaceScopeValue, canView: boolean, isEnabled: boolean,
  ): UseQueryOptions<ReceivingTask[]> => createWarehouseQuery(client, scope, canView, isEnabled, receivingResource),
  topology: (
    client: ApiClient, scope: WarehouseWorkspaceScopeValue, canView: boolean,
  ): UseQueryOptions<null | WarehouseTopology> => createWarehouseQuery(client, scope, canView, true, topologyResource),
};
