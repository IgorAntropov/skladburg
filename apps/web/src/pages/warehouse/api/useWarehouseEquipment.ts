import type { GetWarehouseEquipmentResponse } from '@skladburg/contracts/wms/v1/warehouse_equipment';
import type { UseQueryResult } from '@tanstack/react-query';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import {
  staffProfilesChannel,
  warehouseChannel,
} from '@skladburg/contracts/runtime';
import { WarehouseEquipmentService } from '@skladburg/contracts/wms/v1/warehouse_equipment';
import {
  skipToken,
  useQuery,
} from '@tanstack/react-query';

import {
  isPermissionGranted,
  useSessionQuery,
} from '@/entities/session';
import {
  useActingContext,
  useApiClient,
} from '@/shared/api';

import { warehouseWorkspaceKey } from './warehouseWorkspaceKey';

type EquipmentQueryValue = Pick<UseQueryResult<GetWarehouseEquipmentResponse>, 'data' | 'error' | 'isFetching'> & { refetch: () => void };

export const useWarehouseEquipment = (warehouseId: string, isEnabled = true): EquipmentQueryValue => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();
  const session = useSessionQuery();
  const permissions = session.isError ? [] : session.data?.permissions ?? [];
  const scope = { kind: 'warehouse', warehouseId } as const;
  const allowed = (code: Parameters<typeof isPermissionGranted>[1]): boolean => isPermissionGranted(permissions, code, scope);
  const canRead = isEnabled && organizationId !== undefined && userId !== undefined && allowed(PermissionCode.WAREHOUSE_VIEW);
  const canReadProfiles = allowed(PermissionCode.STAFF_PROFILE_VIEW);
  const query = useQuery({
    gcTime: 0,
    meta: canRead
      ? canReadProfiles
        ? {
            channels: [warehouseChannel(warehouseId), staffProfilesChannel(warehouseId)],
            eventCases: ['warehouseEquipmentChanged', 'warehouseStaffProfilesChanged'],
          }
        : { channels: [warehouseChannel(warehouseId)], eventCases: ['warehouseEquipmentChanged'] }
      : undefined,
    queryFn: canRead
      ? ({ signal }) => client.service(WarehouseEquipmentService).getWarehouseEquipment({ warehouseId }, { signal })
      : skipToken,
    queryKey: canRead
      ? [
          ...warehouseWorkspaceKey({ organizationId, userId, warehouseId }), 'equipment', allowed(PermissionCode.TASK_VIEW),
          canReadProfiles, allowed(PermissionCode.STAFF_PERFORMANCE_VIEW),
        ]
      : ['warehouse-equipment-disabled'],
    refetchOnWindowFocus: true,
  });

  return session.isError
    ? { data: undefined, error: session.error, isFetching: session.isFetching, refetch: () => { void session.refetch(); } }
    : query;
};
