import type {
  GetWarehouseStaffProfileResponse,
  WarehouseStaffSummary,
} from '@skladburg/contracts/wms/v1/warehouse_staff_profile';
import type {
  QueryKey,
  UseQueryResult,
} from '@tanstack/react-query';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import {
  getPermissionName,
  staffProfilesChannel,
} from '@skladburg/contracts/runtime';
import { WarehouseStaffProfileService } from '@skladburg/contracts/wms/v1/warehouse_staff_profile';
import {
  skipToken,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import type {
  ApiClient,
  ApiQueryMetaValue,
} from '@/shared/api';

import {
  isPermissionGranted,
  useSessionQuery,
} from '@/entities/session';
import {
  collectPages,
  useActingContext,
  useApiClient,
} from '@/shared/api';

interface WarehouseStaffScopeValue {
  canRead: boolean;
  client: ApiClient;
  meta: ApiQueryMetaValue | undefined;
  queryKey: QueryKey;
}

const staffPermissions = new Set<string>([
  getPermissionName(PermissionCode.STAFF_PERFORMANCE_VIEW),
  getPermissionName(PermissionCode.STAFF_PROFILE_VIEW),
  getPermissionName(PermissionCode.STAFF_QUALIFICATION_VIEW),
]);

const useStaffScope = (warehouseId: string | undefined): WarehouseStaffScopeValue => {
  const client = useApiClient();
  const actor = useActingContext();
  const session = useSessionQuery();
  const permissions = session.isError ? [] : session.data?.permissions ?? [];
  const scope = warehouseId === undefined ? { kind: 'organization' } as const : { kind: 'warehouse', warehouseId } as const;
  const allowed = (code: Parameters<typeof isPermissionGranted>[1]): boolean => isPermissionGranted(permissions, code, scope);
  const grant = permissions.find(permission => permission.permission === getPermissionName(PermissionCode.STAFF_PROFILE_VIEW));
  const warehouses = warehouseId !== undefined ? [warehouseId] : grant?.isOrganizationWide ? [undefined] : grant?.warehouseIds ?? [];
  const canRead = actor.userId !== undefined && actor.organizationId !== undefined && grant !== undefined
    && (warehouseId === undefined || allowed(PermissionCode.STAFF_PROFILE_VIEW));
  const grants = permissions.filter(grant => staffPermissions.has(grant.permission))
    .map(({ isOrganizationWide, permission, warehouseIds }) => [permission, isOrganizationWide, warehouseIds]);
  const queryKey = ['warehouse-staff-profile', actor.organizationId, actor.userId, warehouseId, grants];
  const channels = warehouses.flatMap(id => id === undefined ? [] : [staffProfilesChannel(id)]);
  const meta: ApiQueryMetaValue | undefined = canRead && channels.length > 0
    ? { channels, eventCases: ['warehouseStaffProfilesChanged'] }
    : undefined;
  return { canRead, client, meta, queryKey };
};

export const useWarehouseStaffList = (warehouseId: string | undefined, isEnabled = true): UseQueryResult<WarehouseStaffSummary[]> => {
  const cache = useQueryClient();
  const { canRead, client, meta, queryKey } = useStaffScope(warehouseId);
  const canListStaff = canRead && isEnabled;
  const listKey = [...queryKey, 'list', canListStaff];
  const staff = cache.getQueryData<WarehouseStaffSummary[]>(listKey);
  const channels = [...new Set(staff?.map(member => staffProfilesChannel(member.warehouseId)))];
  const listMeta: ApiQueryMetaValue | undefined = meta ?? (canRead && channels.length > 0
    ? { channels, eventCases: ['warehouseStaffProfilesChanged'] }
    : undefined);
  return useQuery({
    gcTime: 0,
    meta: canListStaff ? listMeta : undefined,
    queryFn: canListStaff
      ? ({ signal }) => collectPages(async (page) => {
          const response = await client.service(WarehouseStaffProfileService).listWarehouseStaff({ page, warehouseId }, { signal });
          return { items: response.staff, nextPageToken: response.page?.nextPageToken ?? '' };
        })
      : skipToken,
    queryKey: listKey,
  });
};

export const useWarehouseStaffProfile = (warehouseId: string, staffId: string): UseQueryResult<GetWarehouseStaffProfileResponse> => {
  const { canRead, client, meta, queryKey } = useStaffScope(warehouseId);
  return useQuery({
    gcTime: 0,
    meta,
    queryFn: canRead
      ? ({ signal }) => client.service(WarehouseStaffProfileService).getWarehouseStaffProfile({ staffId, warehouseId }, { signal })
      : skipToken,
    queryKey: [...queryKey, staffId, canRead],
  });
};
