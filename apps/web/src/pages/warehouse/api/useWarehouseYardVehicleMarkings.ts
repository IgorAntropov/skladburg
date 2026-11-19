import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import {
  organizationChannel,
  tasksChannel,
  warehouseChannel,
} from '@skladburg/contracts/runtime';
import {
  skipToken,
  useQuery,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  isPermissionGranted,
  useSessionQuery,
} from '@/entities/session';
import {
  useActingContext,
  useApiClient,
} from '@/shared/api';

import type { WarehouseYardVehicleMarkingVisualValue } from '../model/warehouseYardVehicleMarkingVisual';
import type { WarehouseYardVehicleMarkingRowValue } from './readWarehouseYardVehicleMarkings';

import { warehouseWorkspaceKey } from './warehouseWorkspaceKey';

const ORGANIZATION = { kind: 'organization' } as const;
const MARKING_PERMISSIONS = [PermissionCode.FLEET_VIEW, PermissionCode.NETWORK_VIEW, PermissionCode.TRIP_VIEW] as const;

const selectMarkings = (
  rows: readonly WarehouseYardVehicleMarkingRowValue[],
): ReadonlyMap<string, WarehouseYardVehicleMarkingVisualValue> => new Map(rows.map(({ taskId, ...marking }) => [taskId, marking]));

export const useWarehouseYardVehicleMarkings = (
  warehouseId: string,
  taskIds: readonly string[],
  isEnabled: boolean,
): ReadonlyMap<string, WarehouseYardVehicleMarkingVisualValue> | undefined => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();
  const session = useSessionQuery();
  const permissions = session.isError ? [] : session.data?.permissions ?? [];
  const ids = useMemo(() => [...new Set(taskIds.filter(Boolean))].sort(), [taskIds]);
  const canRead = isEnabled && ids.length > 0 && organizationId !== undefined && userId !== undefined
    && isPermissionGranted(permissions, PermissionCode.TASK_VIEW, { kind: 'warehouse', warehouseId });
  const access = MARKING_PERMISSIONS.filter(permission => isPermissionGranted(permissions, permission, ORGANIZATION)).join(',');
  const scope = [...warehouseWorkspaceKey({ organizationId, userId, warehouseId }), 'yard-vehicle-markings', access];
  const query = useQuery({
    gcTime: 0,
    meta: canRead
      ? {
          channels: [organizationChannel(organizationId), tasksChannel(warehouseId), warehouseChannel(warehouseId)],
          eventCases: ['transportRequestChanged', 'dealChanged', 'receivingTasksChanged', 'pickingTasksChanged'],
        }
      : undefined,
    placeholderData: (previous, previousQuery) => {
      if (!canRead || previousQuery?.state.status !== 'success' || !scope.every((part, index) => part === previousQuery.queryKey[index])) {
        return undefined;
      }

      const requested = new Set(ids);
      return previous?.filter(({ taskId }) => requested.has(taskId));
    },
    queryFn: canRead
      ? async ({ signal }) => {
        const { readWarehouseYardVehicleMarkings } = await import('./readWarehouseYardVehicleMarkings');

        return readWarehouseYardVehicleMarkings(client, warehouseId, ids, signal);
      }
      : skipToken,
    queryKey: canRead ? [...scope, ids] : ['yard-vehicle-markings-disabled'],
    select: selectMarkings,
  });

  return canRead && !query.isError ? query.data : undefined;
};
