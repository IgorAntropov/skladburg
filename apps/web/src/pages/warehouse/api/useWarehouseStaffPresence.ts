import type { GetWarehouseStaffPresenceResponse } from '@skladburg/contracts/wms/v1/warehouse_staff_presence';
import type { UseQueryResult } from '@tanstack/react-query';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import { staffChannel } from '@skladburg/contracts/runtime';
import { WarehouseStaffPresenceService } from '@skladburg/contracts/wms/v1/warehouse_staff_presence';
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

type StaffPresenceQueryValue = Pick<UseQueryResult<GetWarehouseStaffPresenceResponse>,
  'data' | 'error' | 'isFetching'> & { refetch: () => void };

export const useWarehouseStaffPresence = (warehouseId: string, isEnabled = true): StaffPresenceQueryValue => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();
  const session = useSessionQuery();
  const permissions = session.isError ? [] : session.data?.permissions ?? [];
  const scope = { kind: 'warehouse', warehouseId } as const;
  const canRead = isEnabled && organizationId !== undefined && userId !== undefined
    && isPermissionGranted(permissions, PermissionCode.STAFF_VIEW, scope);
  const query = useQuery({
    gcTime: 0,
    meta: canRead ? { channels: [staffChannel(warehouseId)], eventCases: ['warehouseStaffPresenceChanged'] } : undefined,
    queryFn: canRead
      ? ({ signal }) => client.service(WarehouseStaffPresenceService).getWarehouseStaffPresence({ warehouseId }, { signal })
      : skipToken,
    queryKey: canRead
      ? [...warehouseWorkspaceKey({ organizationId, userId, warehouseId }), 'staff']
      : ['warehouse-staff-disabled'],
  });

  return session.isError
    ? { data: undefined, error: session.error, isFetching: session.isFetching, refetch: () => { void session.refetch(); } }
    : query;
};
