import type { PickingTask } from '@skladburg/contracts/wms/v1/picking';
import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';
import type {
  StockBalance,
  StockMovement,
} from '@skladburg/contracts/wms/v1/stock';
import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';
import type { UseQueryResult } from '@tanstack/react-query';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { useQuery } from '@tanstack/react-query';

import {
  isPermissionGranted,
  useSessionQuery,
} from '@/entities/session';
import {
  useActingContext,
  useApiClient,
} from '@/shared/api';

import { warehouseWorkspaceQueries } from './warehouseWorkspaceQueries';

export type WarehouseWorkspaceTabValue = 'addresses' | 'movements' | 'stock' | 'tasks';

export interface WarehouseWorkspaceValue {
  balances: UseQueryResult<StockBalance[]>;
  canViewInventory: boolean;
  canViewTasks: boolean;
  canViewTopology: boolean;
  isSessionPending: boolean;
  movements: UseQueryResult<StockMovement[]>;
  picking: UseQueryResult<PickingTask[]>;
  receiving: UseQueryResult<ReceivingTask[]>;
  topology: UseQueryResult<null | WarehouseTopology>;
}

export const useWarehouseWorkspace = (
  warehouseId: string | undefined,
  tab?: WarehouseWorkspaceTabValue,
): WarehouseWorkspaceValue => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();
  const { data: session, isPending: isSessionPending } = useSessionQuery();
  const permissions = session?.permissions ?? [];
  const warehouse = { kind: 'warehouse', warehouseId: warehouseId ?? '' } as const;
  const scope = { organizationId, userId, warehouseId };
  const canViewInventory = warehouseId !== undefined && isPermissionGranted(permissions, PermissionCode.INVENTORY_VIEW, warehouse);
  const canViewTasks = warehouseId !== undefined && isPermissionGranted(permissions, PermissionCode.TASK_VIEW, warehouse);
  const canViewTopology = warehouseId !== undefined && isPermissionGranted(permissions, PermissionCode.WAREHOUSE_VIEW, warehouse);
  const isTasksEnabled = tab === undefined || tab === 'tasks';
  const topology = useQuery(warehouseWorkspaceQueries.topology(client, scope, canViewTopology));
  const balances = useQuery(warehouseWorkspaceQueries.balances(client, scope, canViewInventory, tab === undefined || tab === 'stock'));
  const movements = useQuery(
    warehouseWorkspaceQueries.movements(client, scope, canViewInventory, tab === undefined || tab === 'movements'),
  );
  const picking = useQuery(warehouseWorkspaceQueries.picking(client, scope, canViewTasks, isTasksEnabled));
  const receiving = useQuery(warehouseWorkspaceQueries.receiving(client, scope, canViewTasks, isTasksEnabled));

  return { balances, canViewInventory, canViewTasks, canViewTopology, isSessionPending, movements, picking, receiving, topology };
};
