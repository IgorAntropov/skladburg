import type {
  Driver,
  Vehicle,
} from '@skladburg/contracts/fleet/v1/fleet';
import type { UseQueryResult } from '@tanstack/react-query';

import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import {
  skipToken,
  useQuery,
} from '@tanstack/react-query';

import { useCan } from '@/entities/session';
import {
  collectPages,
  createOrganizationQueryMeta,
  getOrganizationScope,
  RESYNC_ONLY_EVENT_CASES,
  useActingContext,
  useApiClient,
} from '@/shared/api';

interface AssignmentFleetValue {
  drivers: Driver[];
  vehicles: Vehicle[];
}

export const useAssignmentFleet = (isEnabled: boolean): UseQueryResult<AssignmentFleetValue> => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();
  const canViewFleet = useCan(PermissionCode.FLEET_VIEW, { kind: 'organization' });
  const canFetch = canViewFleet && isEnabled && organizationId !== undefined && userId !== undefined;

  return useQuery({
    meta: createOrganizationQueryMeta(organizationId, RESYNC_ONLY_EVENT_CASES),
    queryFn: canFetch
      ? async ({ signal }): Promise<AssignmentFleetValue> => {
        const { FleetService } = await import('@skladburg/contracts/fleet/v1/fleet');
        const service = client.service(FleetService);
        const [drivers, vehicles] = await Promise.all([
          collectPages(async (page) => {
            const response = await service.listDrivers({ page }, { signal });

            return { items: response.drivers, nextPageToken: response.page?.nextPageToken ?? '' };
          }),
          collectPages(async (page) => {
            const response = await service.listVehicles({ page }, { signal });

            return { items: response.vehicles, nextPageToken: response.page?.nextPageToken ?? '' };
          }),
        ]);

        return {
          drivers,
          vehicles: vehicles.filter(vehicle => vehicle.details !== undefined),
        };
      }
      : skipToken,
    queryKey: ['transport-assignment-fleet', getOrganizationScope(organizationId), userId ?? ''],
  });
};
